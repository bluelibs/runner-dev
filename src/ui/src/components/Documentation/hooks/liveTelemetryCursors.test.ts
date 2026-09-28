import {
  advanceCursors,
  emptyCursors,
  keepUnseenEntries,
} from "./liveTelemetryCursors";
import type { LogEntry, RunRecord } from "./liveTelemetry.types";

const log = (sequence: number): LogEntry => ({
  sequence,
  timestampMs: 1_000,
  level: "info",
  message: `log-${sequence}`,
});

const run = (sequence: number): RunRecord => ({
  sequence,
  timestampMs: 1_000,
  nodeId: `node-${sequence}`,
  nodeKind: "TASK",
  ok: true,
});

describe("liveTelemetryCursors", () => {
  test("advances every fetched category on its own", () => {
    const cursors = advanceCursors(
      { logs: 3, emissions: 9, errors: null, runs: null },
      { logs: [log(4), log(7)], emissions: [], errors: [], runs: undefined }
    );

    expect(cursors).toEqual({
      logs: 7,
      // Nothing new keeps the position.
      emissions: 9,
      // Fetched-and-empty with no position yet: everything from the start.
      errors: 0,
      // Not fetched: still unknown.
      runs: null,
    });
  });

  test("never moves a cursor backwards", () => {
    expect(
      advanceCursors({ ...emptyCursors(), runs: 10 }, { runs: [run(4)] }).runs
    ).toBe(10);
  });

  test("drops entries at or before each category's cursor", () => {
    const unseen = keepUnseenEntries(
      { logs: [log(1), log(2), log(3)], runs: [run(5)] },
      { logs: 2, emissions: null, errors: null, runs: null }
    );

    expect(unseen.logs?.map((entry) => entry.sequence)).toEqual([3]);
    // No cursor yet: everything is new.
    expect(unseen.runs?.map((entry) => entry.sequence)).toEqual([5]);
    expect(unseen.emissions).toBeUndefined();
  });
});
