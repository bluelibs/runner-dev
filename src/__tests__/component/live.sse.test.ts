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
