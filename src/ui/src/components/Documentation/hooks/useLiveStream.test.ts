/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { graphqlRequest } from "../utils/graphqlClient";
import {
  MAX_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  useLiveStream,
} from "./useLiveStream";
import type { LiveData, LogEntry } from "./liveTelemetry.types";

jest.mock("../utils/graphqlClient", () => ({
  graphqlRequest: jest.fn(),
}));

const graphqlRequestMock = graphqlRequest as jest.MockedFunction<
  typeof graphqlRequest
>;

type Listener = (event: MessageEvent) => void;

/** Minimal stand-in: jsdom ships no EventSource. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Listener>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const data =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    act(() => {
      this.listeners.get(type)?.({ data } as MessageEvent);
    });
  }
}

const latestSource = () =>
  FakeEventSource.instances[FakeEventSource.instances.length - 1];

const globals = globalThis as unknown as Record<string, unknown>;

const HEALTH = {
  memory: { heapUsed: 10, heapTotal: 20, rss: 30 },
  cpu: { usage: 0.25, loadAverage: 1 },
  eventLoop: { lag: 4 },
  gc: { collections: 2, duration: 5 },
};

const log = (sequence: number): LogEntry => ({
  sequence,
  timestampMs: 1_000,
  level: "info",
  message: `log-${sequence}`,
});

const telemetry = (logs: LogEntry[]) => ({
  logs,
  emissions: [],
  errors: [],
  runs: [],
});

const pollResponse = (live: Partial<LiveData>) => ({ live });

const logSequences = (data: LiveData | null) =>
  data?.logs.map((entry) => entry.sequence);

function lastVariables(): Record<string, unknown> | undefined {
  const calls = graphqlRequestMock.mock.calls;
  return calls[calls.length - 1]?.[1];
}

describe("useLiveStream", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    globals.EventSource = FakeEventSource;
    graphqlRequestMock.mockReset();
  });

  afterEach(() => {
    delete globals.EventSource;
    delete globals.__API_URL__;
    jest.restoreAllMocks();
  });

  test("streams SSE telemetry and health, dropping entries replayed by the server", () => {
    globals.__API_URL__ = "http://api.test";
    const { result } = renderHook(() => useLiveStream());
    const source = latestSource();
    expect(source.url).toBe("http://api.test/live/stream");

    act(() => source.onopen?.());
    expect(result.current.connectionMode).toBe("sse");

    source.emit("telemetry", telemetry([log(1), log(2)]));
    // A reconnect replays the store: already-seen sequences are skipped.
    source.emit("telemetry", telemetry([log(2), log(3)]));
    source.emit("telemetry", {});
    expect(logSequences(result.current.liveData)).toEqual([1, 2, 3]);

    source.emit("health", HEALTH);
    expect(result.current.liveData?.memory).toEqual(HEALTH.memory);

    source.emit("telemetry", "not json");
    source.emit("health", "{");
    expect(logSequences(result.current.liveData)).toEqual([1, 2, 3]);
  });

  test("hands the stream's per-category cursors over to polling when SSE fails", async () => {
    graphqlRequestMock.mockResolvedValue(
      pollResponse({
        ...HEALTH,
        logs: [log(3)],
        emissions: [],
        errors: [],
        runs: [],
      })
    );
    globals.__API_URL__ = "";
    const { result } = renderHook(() => useLiveStream());
    const source = latestSource();
    expect(source.url).toBe(`${window.location.origin}/live/stream`);

    source.emit("telemetry", telemetry([log(1), log(2)]));
    act(() => source.onerror?.());

    expect(source.closed).toBe(true);
    expect(result.current.connectionMode).toBe("polling");
    expect(graphqlRequestMock.mock.calls[0][1]).toMatchObject({
      logsAfter: 2,
      logsLast: 100,
      // Empty on the stream, so every future entry is new.
      emissionsAfter: 0,
      errorsAfter: 0,
      runsAfter: 0,
    });
    await waitFor(() =>
      expect(logSequences(result.current.liveData)).toEqual([1, 2, 3])
    );
  });

  test("polls without EventSource: recent history first, then per-category cursors", async () => {
    delete globals.EventSource;
    graphqlRequestMock
      .mockResolvedValueOnce(
        pollResponse({
          ...HEALTH,
          logs: [log(5), log(6)],
          emissions: [],
          errors: [],
          runs: [],
        })
      )
      .mockResolvedValue(
        pollResponse({ logs: [log(7)], emissions: [], errors: [], runs: [] })
      );

    const { result, unmount } = renderHook(() =>
      useLiveStream({ initialPollInterval: 20 })
    );

    expect(result.current.connectionMode).toBe("polling");
    expect(graphqlRequestMock.mock.calls[0][1]).toMatchObject({
      logsAfter: null,
      logsLast: 10,
    });
    await waitFor(() =>
      expect(graphqlRequestMock.mock.calls.length).toBeGreaterThan(1)
    );
    expect(graphqlRequestMock.mock.calls[1][1]).toMatchObject({
      logsAfter: 6,
      logsLast: 100,
      emissionsAfter: 0,
      runsAfter: 0,
    });
    await waitFor(() =>
      expect(logSequences(result.current.liveData)).toEqual([5, 6, 7])
    );
    expect(result.current.liveData?.cpu).toEqual(HEALTH.cpu);

    unmount();
    const callsAtUnmount = graphqlRequestMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(graphqlRequestMock.mock.calls.length).toBe(callsAtUnmount);
  });

  test("detailed mode asks for a longer initial history", () => {
    graphqlRequestMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLiveStream({ detailed: true }));

    act(() => result.current.refresh());

    expect(lastVariables()).toMatchObject({ logsLast: 50 });
  });

  test("reports poll failures and clears them after a successful refresh", async () => {
    const { result } = renderHook(() => useLiveStream());

    graphqlRequestMock.mockRejectedValueOnce(new Error("boom"));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBe("boom"));

    graphqlRequestMock.mockRejectedValueOnce("not an error");
    act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.error).toBe("Failed to fetch live data")
    );

    graphqlRequestMock.mockResolvedValueOnce(pollResponse({ logs: [log(1)] }));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(logSequences(result.current.liveData)).toEqual([1]);
  });

  test("never overlaps two polls", async () => {
    let finishPoll: (value: unknown) => void = () => {};
    graphqlRequestMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPoll = resolve;
      })
    );
    const { result } = renderHook(() => useLiveStream());

    act(() => result.current.refresh());
    act(() => result.current.refresh());
    expect(graphqlRequestMock).toHaveBeenCalledTimes(1);

    await act(async () => finishPoll(pollResponse({ logs: [log(1)] })));
    graphqlRequestMock.mockResolvedValue(pollResponse({}));
    act(() => result.current.refresh());
    expect(graphqlRequestMock).toHaveBeenCalledTimes(2);
  });

  test("pausing closes the stream and ignores late events; resuming reconnects", () => {
    const { result } = renderHook(() => useLiveStream());
    const first = latestSource();

    act(() => result.current.setIsActive(false));
    expect(first.closed).toBe(true);
    first.emit("telemetry", telemetry([log(1)]));
    first.emit("health", HEALTH);
    expect(result.current.liveData).toBeNull();

    act(() => result.current.setIsActive(true));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(latestSource()).not.toBe(first);
  });

  test("clamps the poll interval and restarts polling with it", () => {
    delete globals.EventSource;
    graphqlRequestMock.mockReturnValue(new Promise(() => {}));
    const setIntervalSpy = jest.spyOn(window, "setInterval");
    const { result } = renderHook(() => useLiveStream());

    act(() => result.current.setPollInterval(1));
    expect(result.current.pollInterval).toBe(MIN_POLL_INTERVAL_MS);
    act(() => result.current.setPollInterval(60_000));
    expect(result.current.pollInterval).toBe(MAX_POLL_INTERVAL_MS);

    const intervals = setIntervalSpy.mock.calls.map((call) => call[1]);
    expect(intervals).toContain(MIN_POLL_INTERVAL_MS);
    expect(intervals).toContain(MAX_POLL_INTERVAL_MS);
  });

  test("a poll tick that fires after pausing does nothing", () => {
    jest.useFakeTimers();
    try {
      delete globals.EventSource;
      graphqlRequestMock.mockResolvedValue(pollResponse({}));
      // Keep the timer alive past the pause to reach the tick's own guard.
      jest.spyOn(window, "clearInterval").mockImplementation(() => {});
      const { result } = renderHook(() =>
        useLiveStream({ initialPollInterval: 1_000 })
      );
      act(() => result.current.setIsActive(false));
      const callsAtPause = graphqlRequestMock.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(3_000);
      });

      expect(graphqlRequestMock.mock.calls.length).toBe(callsAtPause);
    } finally {
      jest.useRealTimers();
    }
  });
});
