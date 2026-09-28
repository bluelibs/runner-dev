import { run } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import {
  live,
  type ErrorEntry,
  type Live,
  type LiveCursorOptions,
  type LiveEntryStamp,
  type LogEntry,
} from "../../resources/live.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { createLiveStreamHandler } from "../../resources/routeHandlers/createLiveStreamHandler";
import type { Request, Response } from "express";

type Listener = (...args: unknown[]) => void;

/**
 * Creates a mock Express request/response pair for testing SSE.
 * The response collects written frames; `writeResult` lets a test simulate
 * a saturated socket (false) or a broken one (throw).
 */
function createMockSseContext(
  writeResult: (chunk: string) => boolean = () => true
) {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const listeners: Record<string, Listener[]> = {};

  const req = {} as Request;
  const mock = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    flushHeaders: jest.fn(),
    write(chunk: string) {
      const accepted = writeResult(chunk);
      written.push(chunk);
      return accepted;
    },
    on(event: string, handler: Listener) {
      (listeners[event] ??= []).push(handler);
      return mock;
    },
  };
  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of listeners[event] ?? []) handler(...args);
  };

  return {
    req,
    res: mock as unknown as Response,
    flushHeaders: mock.flushHeaders,
    written,
    headers,
    emit,
  };
}

interface TelemetryFrame {
  logs: LogEntry[];
  emissions: unknown[];
  errors: ErrorEntry[];
  runs: unknown[];
}

function telemetryFrames(written: string[]): TelemetryFrame[] {
  return written
    .filter((frame) => frame.startsWith("event: telemetry"))
    .map((frame) => {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      return JSON.parse(dataLine!.slice("data: ".length)) as TelemetryFrame;
    });
}

function deliveredLogMessages(written: string[]): string[] {
  return telemetryFrames(written).flatMap((frame) =>
    frame.logs.map((log) => log.message)
  );
}

/** Mirrors the store's cursor contract: oldest `last` entries after the cursor. */
function pageAfterSequence<T extends LiveEntryStamp>(
  entries: T[],
  query: number | LiveCursorOptions | undefined
): T[] {
  const options = typeof query === "object" ? query : {};
  return entries
    .filter((entry) => entry.sequence > (options.afterSequence ?? 0))
    .slice(0, options.last ?? entries.length);
}

function stubLive(overrides: Partial<Live> = {}): Live {
  return {
    getLogs: () => [],
    getEmissions: () => [],
    getErrors: () => [],
    getRuns: () => [],
    recordLog: () => {},
    recordEmission: () => {},
    recordError: () => {},
    recordRun: () => {},
    onRecord: () => () => {},
    ...overrides,
  };
}

function stubLogs(count: number, prefix: string): LogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    sequence: i + 1,
    // Every entry shares one millisecond on purpose.
    timestampMs: 1_000,
    level: "info",
    message: `${prefix}-${i}`,
  }));
}

describe("createLiveStreamHandler", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("sets correct SSE headers", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, headers, flushHeaders, emit } = createMockSseContext();

    handler(req, res);

    expect(headers["Content-Type"]).toBe("text/event-stream");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["Connection"]).toBe("keep-alive");
    expect(flushHeaders).toHaveBeenCalled();

    // Cleanup: close the connection
    emit("close");
    await dispose();
  });

  test("pushes initial health snapshot on connect", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Should have written at least one health event immediately
    const healthEvents = written.filter((w) => w.includes("event: health"));
    expect(healthEvents.length).toBeGreaterThanOrEqual(1);

    // Parse the first health event
    const healthData = healthEvents[0]
      .split("\n")
      .find((l) => l.startsWith("data: "));
    expect(healthData).toBeDefined();
    const parsed = JSON.parse(healthData!.replace("data: ", ""));
    expect(parsed).toHaveProperty("memory");
    expect(parsed).toHaveProperty("cpu");
    expect(parsed).toHaveProperty("eventLoop");
    expect(parsed).toHaveProperty("gc");
    expect(parsed.memory).toHaveProperty("heapUsed");
    expect(parsed.memory).toHaveProperty("heapTotal");
    expect(parsed.memory).toHaveProperty("rss");

    emit("close");
    await dispose();
  });

  test("pushes telemetry delta with sequences when live records new data", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Record a new log entry
    liveInstance.recordLog("info", "sse-test-message");

    // Wait for debounce (100ms) + buffer
    await new Promise((r) => setTimeout(r, 200));

    const ourLog = telemetryFrames(written)
      .flatMap((frame) => frame.logs)
      .find((log) => log.message === "sse-test-message");
    expect(ourLog).toBeDefined();
    // The UI hands this cursor over to the polling fallback.
    expect(typeof ourLog!.sequence).toBe("number");

    emit("close");
    await dispose();
  });

  test("drains same-millisecond bursts across page cuts without losing entries", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    // One frozen millisecond for the whole burst: every page cut (1,000
    // entries) splits entries sharing a timestamp, which a timestamp cursor
    // would drop for good.
    const frozenNow = Date.now() + 100_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(frozenNow);
    const total = 2_500;
    try {
      for (let i = 0; i < total; i++) {
        liveInstance.recordLog("info", `burst-${i}`);
      }
    } finally {
      nowSpy.mockRestore();
    }

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    const burstLogs = telemetryFrames(written)
      .flatMap((frame) => frame.logs)
      .filter((log) => log.message.startsWith("burst-"));

    expect(burstLogs.every((log) => log.timestampMs === frozenNow)).toBe(true);
    expect(burstLogs.map((log) => log.message)).toEqual(
      Array.from({ length: total }, (_, i) => `burst-${i}`)
    );
    expect(new Set(burstLogs.map((log) => log.sequence)).size).toBe(total);

    emit("close");
    await dispose();
  });

  test("serializes error payloads and exits the drain on empty pages", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const errors: ErrorEntry[] = Array.from({ length: 1000 }, (_, i) => ({
      sequence: i + 1,
      timestampMs: 1_000,
      sourceId: "stub-task",
      sourceKind: "TASK",
      message: `stub-error-${i}`,
      stack: null,
      data: i === 0 ? circular : i === 1 ? "already-serialized" : null,
      correlationId: null,
    }));
    const getErrors = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(errors, query)
    );

    const handler = createLiveStreamHandler({ live: stubLive({ getErrors }) });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Full first page, then an empty second page that exits the loop.
    expect(getErrors).toHaveBeenCalledTimes(2);
    expect(getErrors).toHaveBeenLastCalledWith({
      afterSequence: 1000,
      last: 1000,
    });
    const frames = telemetryFrames(written);
    expect(frames).toHaveLength(1);
    expect(frames[0].errors).toHaveLength(1000);
    expect(frames[0].errors[0].data).toBe("[object Object]");
    expect(frames[0].errors[1].data).toBe("already-serialized");

    emit("close");
  });

  test("tracks each telemetry category with its own sequence cursor", () => {
    // 1005 older logs plus one newer error: a shared maximum cursor would
    // jump past the undelivered logs once the error lands.
    const logs = stubLogs(1005, "cat-log");
    const errors: ErrorEntry[] = [
      {
        sequence: 5_000,
        timestampMs: 5_000,
        sourceId: "stub-task",
        sourceKind: "TASK",
        message: "cat-error",
      },
    ];
    const live = stubLive({
      getLogs: (query) => pageAfterSequence(logs, query),
      getErrors: (query) => pageAfterSequence(errors, query),
    });

    const handler = createLiveStreamHandler({ live });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    const delivered = deliveredLogMessages(written);
    expect(delivered).toHaveLength(1005);
    expect(delivered[0]).toBe("cat-log-0");
    expect(delivered[1004]).toBe("cat-log-1004");
    const deliveredErrors = telemetryFrames(written).flatMap(
      (frame) => frame.errors
    );
    expect(deliveredErrors).toHaveLength(1);

    emit("close");
  });

  test("schedules another drain when the page cap hides backlog", async () => {
    const logs = stubLogs(10_005, "cap-log");
    const getLogs = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(logs, query)
    );

    const handler = createLiveStreamHandler({ live: stubLive({ getLogs }) });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);
    // Initial push drains 10 full pages, then the scheduled drain delivers
    // the remainder without waiting for new records.
    await new Promise((r) => setTimeout(r, 400));

    const delivered = deliveredLogMessages(written);
    expect(getLogs).toHaveBeenCalledTimes(11);
    expect(delivered).toHaveLength(10_005);
    expect(delivered[10_004]).toBe("cap-log-10004");

    emit("close");
  });

  test("pauses on a saturated socket and resumes losslessly on drain", () => {
    const logs = stubLogs(2_500, "bp-log");
    const getLogs = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(logs, query)
    );
    // The first telemetry frame fills the socket buffer.
    let saturated = true;
    const handler = createLiveStreamHandler({ live: stubLive({ getLogs }) });
    const { req, res, written, emit } = createMockSseContext((chunk) => {
      if (!chunk.startsWith("event: telemetry") || !saturated) return true;
      saturated = false;
      return false;
    });

    handler(req, res);

    // Draining stopped right after the write that reported backpressure.
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(deliveredLogMessages(written)).toHaveLength(1_000);

    emit("drain");

    const delivered = deliveredLogMessages(written);
    expect(delivered).toEqual(logs.map((log) => log.message));

    emit("close");
  });

  test("holds health, heartbeat and debounced pushes until the socket drains", () => {
    jest.useFakeTimers();
    const logs = stubLogs(3, "held-log");
    let notifyRecord: (() => void) | undefined;
    const getLogs = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(logs, query)
    );
    const live = stubLive({
      getLogs,
      onRecord: (callback) => {
        notifyRecord = () => callback("log");
        return () => {};
      },
    });
    let accepting = false;
    const handler = createLiveStreamHandler({ live });
    const { req, res, written, emit } = createMockSseContext(() => accepting);

    handler(req, res);

    // The initial health frame saturates the socket before any telemetry.
    expect(written).toHaveLength(1);
    expect(getLogs).not.toHaveBeenCalled();

    notifyRecord?.();
    jest.advanceTimersByTime(20_000);
    expect(written).toHaveLength(1);
    expect(getLogs).not.toHaveBeenCalled();

    accepting = true;
    emit("drain");
    expect(deliveredLogMessages(written)).toEqual([
      "held-log-0",
      "held-log-1",
      "held-log-2",
    ]);

    // Once flowing again, the periodic frames resume.
    jest.advanceTimersByTime(15_000);
    expect(written.some((frame) => frame === ": heartbeat\n\n")).toBe(true);
    expect(
      written.filter((frame) => frame.startsWith("event: health")).length
    ).toBeGreaterThan(1);

    // A drain without a pending pause is a no-op.
    const writesBeforeSpuriousDrain = written.length;
    emit("drain");
    expect(written).toHaveLength(writesBeforeSpuriousDrain);

    emit("close");
  });

  test("tears down when the socket write throws", () => {
    jest.useFakeTimers();
    const unsubscribe = jest.fn();
    const logs = stubLogs(2_000, "doomed-log");
    const getLogs = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(logs, query)
    );
    const live = stubLive({ getLogs, onRecord: () => unsubscribe });
    const handler = createLiveStreamHandler({ live });
    const { req, res, written } = createMockSseContext((chunk) => {
      if (chunk.startsWith("event: telemetry")) {
        throw new Error("socket destroyed");
      }
      return true;
    });

    handler(req, res);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    // The failed page is not retried and nothing else is scheduled.
    expect(getLogs).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(20_000);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^event: health/);
  });

  test("cancels a pending debounced push when the client disconnects", () => {
    jest.useFakeTimers();
    const logs: LogEntry[] = [];
    let notifyRecord: (() => void) | undefined;
    const getLogs = jest.fn((query?: number | LiveCursorOptions) =>
      pageAfterSequence(logs, query)
    );
    const live = stubLive({
      getLogs,
      onRecord: (callback) => {
        notifyRecord = () => callback("log");
        return () => {};
      },
    });
    const handler = createLiveStreamHandler({ live });
    const { req, res, emit } = createMockSseContext();

    handler(req, res);
    logs.push(...stubLogs(1, "late-log"));
    notifyRecord?.();
    emit("close");
    // A second teardown signal is harmless.
    emit("error", new Error("socket reset"));
    jest.advanceTimersByTime(1_000);

    // Only the initial (empty) read happened; the debounced one was cancelled.
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  test("stops pushing after client disconnects", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Disconnect
    emit("close");

    const writtenCountAfterClose = written.length;

    // Record data after close
    liveInstance.recordLog("info", "after-close");
    await new Promise((r) => setTimeout(r, 200));

    // Should not have written any more data
    expect(written.length).toBe(writtenCountAfterClose);

    await dispose();
  });
});
