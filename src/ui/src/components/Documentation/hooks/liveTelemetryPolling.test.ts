import {
  LIVE_TELEMETRY_QUERY,
  MAX_POLL_PAGES_PER_TICK,
  POLL_PAGE_SIZE,
  pollLiveTelemetry,
  type GraphqlRequest,
  type LiveTelemetryResponse,
} from "./liveTelemetryPolling";
import type {
  LiveData,
  LogEntry,
  RunRecord,
  TelemetryCursors,
} from "./liveTelemetry.types";

type Variables = Record<string, unknown>;

const HEALTH: Pick<LiveData, "memory" | "cpu" | "eventLoop" | "gc"> = {
  memory: { heapUsed: 1, heapTotal: 2, rss: 3 },
  cpu: { usage: 0.5, loadAverage: 1 },
  eventLoop: { lag: 2 },
  gc: { collections: 1, duration: 3 },
};

function logs(from: number, count: number): LogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    sequence: from + i,
    timestampMs: 1_000,
    level: "info",
    message: `log-${from + i}`,
  }));
}

function runs(from: number, count: number): RunRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    sequence: from + i,
    timestampMs: 1_000,
    nodeId: `node-${from + i}`,
    nodeKind: "TASK",
    ok: true,
  }));
}

/** Replays scripted `live` payloads and records each request's variables. */
function scriptedRequest(responses: Array<Partial<LiveData>>) {
  const calls: Variables[] = [];
  const request: GraphqlRequest = async <T>(
    query: string,
    variables?: Variables
  ) => {
    expect(query).toBe(LIVE_TELEMETRY_QUERY);
    calls.push(variables ?? {});
    const live = responses[calls.length - 1];
    if (!live) throw new Error(`Unexpected request #${calls.length}`);
    const response: LiveTelemetryResponse = { live };
    return response as T;
  };
  return { request, calls };
}

const cursors = (partial: Partial<TelemetryCursors>): TelemetryCursors => ({
  logs: null,
  emissions: null,
  errors: null,
  runs: null,
  ...partial,
});

describe("pollLiveTelemetry", () => {
  test("first poll asks for recent history per category and never drains it", async () => {
    const { request, calls } = scriptedRequest([
      { ...HEALTH, logs: logs(1, 10), emissions: [], errors: [], runs: [] },
    ]);

    const poll = await pollLiveTelemetry(request, {
      cursors: cursors({}),
      historySize: 10,
    });

    expect(calls).toEqual([
      {
        healthIncluded: true,
        logsIncluded: true,
        logsAfter: null,
        logsLast: 10,
        emissionsIncluded: true,
        emissionsAfter: null,
        emissionsLast: 10,
        errorsIncluded: true,
        errorsAfter: null,
        errorsLast: 10,
        runsIncluded: true,
        runsAfter: null,
        runsLast: 10,
      },
    ]);
    expect(poll.health).toEqual(HEALTH);
    expect(poll.delta.logs).toHaveLength(10);
    expect(poll.delta.runs).toEqual([]);
  });

  test("pages each category from its own cursor and drains only the lagging ones", async () => {
    const { request, calls } = scriptedRequest([
      // Round 1: logs come back full, runs are caught up.
      { ...HEALTH, logs: logs(11, POLL_PAGE_SIZE), runs: runs(501, 2) },
      // Round 2: only logs are re-queried; still full.
      { logs: logs(111, POLL_PAGE_SIZE) },
      // Round 3: logs catch up. Missing lists count as empty.
      { logs: logs(211, 5) },
    ]);

    const poll = await pollLiveTelemetry(request, {
      cursors: cursors({ logs: 10, emissions: 40, errors: 70, runs: 500 }),
      historySize: 10,
    });

    expect(calls[0]).toMatchObject({
      healthIncluded: true,
      logsAfter: 10,
      logsLast: POLL_PAGE_SIZE,
      emissionsAfter: 40,
      errorsAfter: 70,
      runsAfter: 500,
    });
    const drainRound = {
      healthIncluded: false,
      logsIncluded: true,
      emissionsIncluded: false,
      emissionsAfter: null,
      errorsIncluded: false,
      runsIncluded: false,
    };
    expect(calls[1]).toMatchObject({ ...drainRound, logsAfter: 110 });
    expect(calls[2]).toMatchObject({ ...drainRound, logsAfter: 210 });
    expect(calls).toHaveLength(3);

    const sequences = poll.delta.logs?.map((entry) => entry.sequence);
    expect(sequences).toEqual(
      Array.from({ length: 2 * POLL_PAGE_SIZE + 5 }, (_, i) => 11 + i)
    );
    expect(poll.delta.runs?.map((entry) => entry.sequence)).toEqual([501, 502]);
    expect(poll.delta.emissions).toEqual([]);
    expect(poll.health).toEqual(HEALTH);
  });

  test("stops after the per-tick page bound even if backlog remains", async () => {
    const responses = Array.from(
      { length: MAX_POLL_PAGES_PER_TICK + 1 },
      (_, round) => ({ logs: logs(1 + round * POLL_PAGE_SIZE, POLL_PAGE_SIZE) })
    );
    const { request, calls } = scriptedRequest(responses);

    const poll = await pollLiveTelemetry(request, {
      cursors: cursors({ logs: 0, emissions: 0, errors: 0, runs: 0 }),
      historySize: 10,
    });

    expect(calls).toHaveLength(MAX_POLL_PAGES_PER_TICK);
    expect(poll.delta.logs).toHaveLength(
      MAX_POLL_PAGES_PER_TICK * POLL_PAGE_SIZE
    );
  });
});
