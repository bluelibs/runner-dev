import type { Request, Response } from "express";
import type { Live, LiveRecordKind } from "../../resources/live.resource";
import { createLiveStreamHandler } from "../../resources/routeHandlers/createLiveStreamHandler";
import { LiveStreamRegistry } from "../../resources/routeHandlers/liveStreamRegistry";

type Listener = () => void;

/** Live store stub that only tracks record subscriptions. */
function createSubscriptionTrackingLive() {
  const listeners = new Set<(kind: LiveRecordKind) => void>();
  const liveStub: Live = {
    getLogs: () => [],
    getEmissions: () => [],
    getErrors: () => [],
    getRuns: () => [],
    recordLog: () => {},
    recordEmission: () => {},
    recordError: () => {},
    recordRun: () => {},
    onRecord: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { liveStub, listeners };
}

/** Minimal SSE response: records headers, frames, `end` calls and handlers. */
function createMockStream() {
  const headers: Record<string, string> = {};
  const written: string[] = [];
  const handlers: Record<string, Listener[]> = {};
  const end = jest.fn();
  const mock = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    flushHeaders: () => {},
    write: (chunk: string) => {
      written.push(chunk);
      return true;
    },
    end,
    on: (event: string, handler: Listener) => {
      (handlers[event] ??= []).push(handler);
      return mock;
    },
  };
  const emit = (event: string) => {
    for (const handler of handlers[event] ?? []) handler();
  };
  return {
    req: {} as Request,
    // A partial stand-in: the handler only uses the members above.
    res: mock as unknown as Response,
    headers,
    written,
    end,
    emit,
  };
}

describe("LiveStreamRegistry", () => {
  test("ends every open stream once and refuses new ones afterwards", () => {
    const registry = new LiveStreamRegistry();
    const first: jest.Mock<void, []> = jest.fn(() => registry.delete(first));
    const second: jest.Mock<void, []> = jest.fn(() => registry.delete(second));
    registry.add(first);
    registry.add(second);
    expect(registry.isShuttingDown).toBe(false);

    registry.endAll();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);
    expect(registry.isShuttingDown).toBe(true);
    // A stream registered now would never be ended: that is a caller bug.
    expect(() => registry.add(jest.fn())).toThrow("check isShuttingDown first");
  });
});

describe("createLiveStreamHandler on server shutdown", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("ends the response and stops every timer and subscription", () => {
    jest.useFakeTimers();
    const { liveStub, listeners } = createSubscriptionTrackingLive();
    const streams = new LiveStreamRegistry();
    const { req, res, written, end } = createMockStream();

    createLiveStreamHandler({ live: liveStub, streams })(req, res);
    expect(streams.size).toBe(1);
    expect(listeners.size).toBe(1);

    streams.endAll();
    const framesAtShutdown = written.length;
    // Past the health (2 s) and heartbeat (15 s) intervals.
    jest.advanceTimersByTime(60_000);

    expect(end).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(framesAtShutdown);
    expect(listeners.size).toBe(0);
    expect(streams.size).toBe(0);
  });

  test("forgets a stream whose client disconnected", () => {
    const { liveStub } = createSubscriptionTrackingLive();
    const streams = new LiveStreamRegistry();
    const { req, res, emit, end } = createMockStream();

    createLiveStreamHandler({ live: liveStub, streams })(req, res);
    emit("close");
    streams.endAll();

    expect(streams.size).toBe(0);
    expect(end).not.toHaveBeenCalled();
  });

  // Its connection outlived server.close(), so keep-alive would hold
  // shutdown open, and a reconnecting EventSource could hold it forever.
  test("ends a stream that arrives after shutdown began and closes its connection", () => {
    const { liveStub, listeners } = createSubscriptionTrackingLive();
    const streams = new LiveStreamRegistry();
    streams.endAll();
    const { req, res, headers, written, end } = createMockStream();

    createLiveStreamHandler({ live: liveStub, streams })(req, res);

    expect(headers.Connection).toBe("close");
    expect(end).toHaveBeenCalledTimes(1);
    expect(written).toEqual([]);
    expect(listeners.size).toBe(0);
    expect(streams.size).toBe(0);
  });
});
