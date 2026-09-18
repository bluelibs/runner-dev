import { run } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { createLiveStreamHandler } from "../../resources/routeHandlers/createLiveStreamHandler";
import type { Request, Response } from "express";

/**
 * Creates a mock Express request/response pair for testing SSE.
 * The response collects written data into a buffer string.
 */
function createMockSseContext() {
  const written: string[] = [];
  const headers: Record<string, string> = {};
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};

  const req = {} as Request;
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    flushHeaders: jest.fn(),
    write(chunk: string) {
      written.push(chunk);
      return true;
    },
    on(event: string, handler: (...args: any[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return res;
    },
    emit(event: string, ...args: any[]) {
      for (const h of listeners[event] ?? []) h(...args);
    },
  } as unknown as Response & {
    emit: (event: string, ...args: any[]) => void;
  };

  return { req, res, written, headers, emit: res.emit.bind(res) };
}

describe("createLiveStreamHandler", () => {
  test("sets correct SSE headers", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, headers, emit } = createMockSseContext();

    handler(req, res);

    expect(headers["Content-Type"]).toBe("text/event-stream");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers["Connection"]).toBe("keep-alive");
    expect(res.flushHeaders).toHaveBeenCalled();

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

  test("pushes telemetry delta when live records new data", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Small delay to ensure timestamp cursor from initial push is in the past
    await new Promise((r) => setTimeout(r, 5));

    // Record a new log entry
    liveInstance.recordLog("info", "sse-test-message");

    // Wait for debounce (100ms) + buffer
    await new Promise((r) => setTimeout(r, 200));

    // Should have pushed a telemetry event containing the new log
    const telemetryEvents = written.filter((w) =>
      w.includes("event: telemetry")
    );
    expect(telemetryEvents.length).toBeGreaterThanOrEqual(1);

    // Find the telemetry event that contains our message
    const hasOurLog = telemetryEvents.some((frame) => {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) return false;
      const parsed = JSON.parse(dataLine.replace("data: ", ""));
      return parsed.logs.some(
        (l: { message: string }) => l.message === "sse-test-message"
      );
    });
    expect(hasOurLog).toBe(true);

    emit("close");
    await dispose();
  });

  test("drains bursts larger than one page without dropping entries", async () => {
    const app = createDummyApp([live, telemetry]);
    const { getResourceValue, dispose } = await run(app);
    const liveInstance = await getResourceValue(live);

    // Monotonic clock so every record lands on a distinct timestamp and
    // page boundaries never split entries sharing one millisecond.
    let now = Date.now() + 100_000;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now++);
    const total = 1005;
    for (let i = 0; i < total; i++) {
      liveInstance.recordLog("info", `burst-${i}`);
    }
    nowSpy.mockRestore();

    const handler = createLiveStreamHandler({ live: liveInstance });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    const delivered: string[] = [];
    for (const frame of written.filter((w) => w.includes("event: telemetry"))) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const parsed = JSON.parse(dataLine.replace("data: ", ""));
      for (const log of parsed.logs ?? []) {
        if (
          typeof log.message === "string" &&
          log.message.startsWith("burst-")
        ) {
          delivered.push(log.message);
        }
      }
    }

    expect(delivered.length).toBe(total);
    expect(delivered[0]).toBe("burst-0");
    expect(delivered[delivered.length - 1]).toBe(`burst-${total - 1}`);

    emit("close");
    await dispose();
  });

  test("serializes error payloads and exits the drain on empty pages", () => {
    const circular: any = {};
    circular.self = circular;
    let calls = 0;
    const stubLive = {
      getLogs: () => [],
      getEmissions: () => [],
      getErrors: () =>
        calls++ === 0
          ? Array.from({ length: 1000 }, (_, i) => ({
              timestampMs: Date.now() + i,
              sourceId: "stub-task",
              sourceKind: "TASK",
              message: `stub-error-${i}`,
              stack: null,
              data: i === 0 ? circular : null,
              correlationId: null,
            }))
          : [],
      getRuns: () => [],
      onRecord: () => () => {},
    };

    const handler = createLiveStreamHandler({ live: stubLive as any });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    // Full first page, then an empty second page that exits the loop.
    expect(calls).toBe(2);
    const telemetry = written.filter((w) => w.includes("event: telemetry"));
    expect(telemetry).toHaveLength(1);
    const dataLine = telemetry[0]
      .split("\n")
      .find((l) => l.startsWith("data: "));
    const parsed = JSON.parse(dataLine!.replace("data: ", ""));
    expect(parsed.errors).toHaveLength(1000);
    expect(parsed.errors[0].data).toBe("[object Object]");

    emit("close");
  });

  test("tracks each telemetry category with its own cursor", () => {
    // 1005 older logs plus one newer error: a shared max-timestamp cursor
    // would jump past the undelivered logs once the error lands.
    const allLogs = Array.from({ length: 1005 }, (_, i) => ({
      timestampMs: 1000 + i,
      level: "info",
      message: `cat-log-${i}`,
    }));
    const allErrors = [
      {
        timestampMs: 5000,
        sourceId: "stub-task",
        sourceKind: "TASK",
        message: "cat-error",
        stack: null,
        data: null,
        correlationId: null,
      },
    ];
    const pageAfter = <T extends { timestampMs: number }>(
      entries: T[],
      query: { afterTimestamp?: number; last?: number }
    ) =>
      entries
        .filter((e) => e.timestampMs > (query.afterTimestamp ?? 0))
        .slice(0, query.last ?? entries.length);
    const stubLive = {
      getLogs: (query: any) => pageAfter(allLogs, query),
      getEmissions: () => [],
      getErrors: (query: any) => pageAfter(allErrors, query),
      getRuns: () => [],
      onRecord: () => () => {},
    };

    const handler = createLiveStreamHandler({ live: stubLive as any });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);

    const deliveredLogs: string[] = [];
    let deliveredErrors = 0;
    for (const frame of written.filter((w) => w.includes("event: telemetry"))) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      const parsed = JSON.parse(dataLine!.replace("data: ", ""));
      for (const log of parsed.logs ?? []) deliveredLogs.push(log.message);
      deliveredErrors += (parsed.errors ?? []).length;
    }

    expect(deliveredLogs.length).toBe(1005);
    expect(deliveredLogs[0]).toBe("cat-log-0");
    expect(deliveredLogs[1004]).toBe("cat-log-1004");
    expect(deliveredErrors).toBe(1);

    emit("close");
  });

  test("schedules another drain when the page cap hides backlog", async () => {
    const allLogs = Array.from({ length: 10_005 }, (_, i) => ({
      timestampMs: 1000 + i,
      level: "info",
      message: `cap-log-${i}`,
    }));
    let calls = 0;
    const stubLive = {
      getLogs: (query: any) => {
        calls++;
        return allLogs
          .filter((l) => l.timestampMs > (query.afterTimestamp ?? 0))
          .slice(0, query.last ?? allLogs.length);
      },
      getEmissions: () => [],
      getErrors: () => [],
      getRuns: () => [],
      onRecord: () => () => {},
    };

    const handler = createLiveStreamHandler({ live: stubLive as any });
    const { req, res, written, emit } = createMockSseContext();

    handler(req, res);
    // Initial push drains 10 full pages, then the scheduled drain delivers
    // the remainder without waiting for new records.
    await new Promise((r) => setTimeout(r, 400));

    const delivered = written
      .filter((w) => w.includes("event: telemetry"))
      .flatMap((frame) => {
        const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
        return JSON.parse(dataLine!.replace("data: ", "")).logs ?? [];
      });

    expect(calls).toBe(11);
    expect(delivered.length).toBe(10_005);
    expect(delivered[10_004].message).toBe("cap-log-10004");

    emit("close");
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
