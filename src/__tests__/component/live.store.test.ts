import { resources, run } from "@bluelibs/runner";
import { createDummyApp, dummyAppIds } from "../dummy/dummyApp";
import { live, type Live } from "../../resources/live.resource";
import { runContext } from "../../resources/telemetry.chain";

async function withLive(
  config: { maxEntries?: number },
  scenario: (store: Live) => void
): Promise<void> {
  const runtime = await run(createDummyApp([live.with(config)]));
  try {
    scenario(await runtime.getResourceValue(live));
  } finally {
    await runtime.dispose();
  }
}

function circular(): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  value.self = value;
  return value;
}

describe("live store sequences and retention", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("stamps every entry with one store-wide, strictly increasing sequence", async () => {
    await withLive({}, (store) => {
      store.recordLog("info", "seq-log");
      store.recordEmission("seq-event");
      store.recordError("seq-source", "INTERNAL", "seq-error");
      store.recordRun("seq-node", "TASK", 1, true);

      const sequences = [
        store.getLogs({ messageIncludes: "seq-log" })[0].sequence,
        store.getEmissions({ eventIds: ["seq-event"] })[0].sequence,
        store.getErrors({ messageIncludes: "seq-error" })[0].sequence,
        store.getRuns({ nodeIds: ["seq-node"] })[0].sequence,
      ];

      expect([...sequences].sort((a, b) => a - b)).toEqual(sequences);
      expect(new Set(sequences).size).toBe(4);
    });
  });

  test("pages losslessly with afterSequence when every entry shares one millisecond", async () => {
    await withLive({}, (store) => {
      jest.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
      for (let i = 0; i < 7; i++)
        store.recordRun(`frozen-${i}`, "TASK", 1, true);

      const delivered: string[] = [];
      let cursor = 0;
      for (;;) {
        const page = store.getRuns({ afterSequence: cursor, last: 3 });
        if (page.length === 0) break;
        delivered.push(...page.map((record) => record.nodeId));
        cursor = page[page.length - 1].sequence;
      }

      expect(delivered).toEqual(
        Array.from({ length: 7 }, (_, i) => `frozen-${i}`)
      );
      // The old millisecond cursor stalls after the first page.
      const firstPage = store.getRuns({ afterTimestamp: 0, last: 3 });
      expect(
        store.getRuns({ afterTimestamp: firstPage[2].timestampMs, last: 3 })
      ).toEqual([]);
    });
  });

  test("keeps the newest maxEntries per category and resumes stale cursors at the oldest retained entry", async () => {
    await withLive({ maxEntries: 3 }, (store) => {
      for (let i = 0; i < 5; i++) store.recordRun(`kept-${i}`, "TASK", 1, true);

      const retained = store.getRuns();
      expect(retained.map((record) => record.nodeId)).toEqual([
        "kept-2",
        "kept-3",
        "kept-4",
      ]);
      expect(
        store.getRuns({ afterSequence: 1, last: 1 }).map((r) => r.nodeId)
      ).toEqual(["kept-2"]);
    });
  });

  test("rejects a maxEntries that is not a non-negative integer", async () => {
    await expect(
      run(createDummyApp([live.with({ maxEntries: 2.5 })]))
    ).rejects.toThrow(/non-negative integer/);
  });

  test("describes errors of any shape for error entries and runs", async () => {
    await withLive({}, (store) => {
      store.recordError("shape-source", "INTERNAL", new Error("as-error"));
      store.recordError("shape-source", "INTERNAL", { code: 7 });
      store.recordError("shape-source", "INTERNAL", circular());
      store.recordRun("shape-node", "TASK", 1, false, new Error("run-error"));
      store.recordRun("shape-node", "TASK", 1, false, "run-string");
      store.recordRun("shape-node", "TASK", 1, false, { code: 8 });
      store.recordRun("shape-node", "TASK", 1, false, circular());
      store.recordRun("shape-node", "TASK", 1, true);

      const errors = store.getErrors({ sourceIds: ["shape-source"] });
      expect(errors.map((entry) => entry.message)).toEqual([
        "as-error",
        '{"code":7}',
        "[object Object]",
      ]);
      expect(errors[0].stack).toContain("as-error");
      expect(errors[1].stack).toBeNull();

      const runs = store.getRuns({ nodeIds: ["shape-node"] });
      expect(runs.map((record) => record.error)).toEqual([
        "run-error",
        "run-string",
        '{"code":8}',
        "[object Object]",
        null,
      ]);
    });
  });

  test("keeps empty ids as given and stamps the ambient correlation id", async () => {
    await withLive({}, (store) => {
      const stackless = new Error("stackless");
      stackless.stack = undefined;
      runContext.run({ chain: [], correlationId: "corr-ambient" }, () => {
        store.recordLog("info", "ambient-log", undefined, undefined, "");
        store.recordEmission("", undefined, "");
        store.recordError("", "INTERNAL", stackless);
        store.recordRun("", "TASK", 1, true, null, "", undefined);
      });

      const logEntry = store.getLogs({ messageIncludes: "ambient-log" })[0];
      expect(logEntry.sourceId).toBe("");
      expect(logEntry.correlationId).toBe("corr-ambient");
      const emission = store.getEmissions({ last: 1 })[0];
      expect(emission.eventId).toBe("");
      expect(emission.emitterId).toBeNull();
      expect(emission.correlationId).toBe("corr-ambient");
      const error = store.getErrors({ last: 1 })[0];
      expect(error.sourceId).toBe("");
      expect(error.stack).toBeNull();
      expect(error.correlationId).toBe("corr-ambient");
      const record = store.getRuns({ last: 1 })[0];
      expect(record.nodeId).toBe("");
      expect(record.parentId).toBe("");
      expect(record.rootId).toBeNull();
      expect(record.correlationId).toBe("corr-ambient");
    });
  });

  test("captures logger errors alongside the log data", async () => {
    const runtime = await run(createDummyApp([live]));
    try {
      const logger = await runtime.getResourceValue(resources.logger);
      await logger.error("logged-with-error", {
        data: { attempt: 2 },
        error: new Error("inner failure"),
      });

      const store = await runtime.getResourceValue(live);
      const [entry] = store.getLogs({ messageIncludes: "logged-with-error" });
      expect(entry.data).toMatchObject({
        attempt: 2,
        error: { message: "inner failure" },
      });
    } finally {
      await runtime.dispose();
    }
  });

  test("canonicalizes short ids for runs, emissions and errors", async () => {
    await withLive({}, (store) => {
      const taskId = dummyAppIds.task("task-hello");
      store.recordRun("task-hello", "TASK", 1, true, null, "task-hello");
      store.recordEmission("evt-hello", undefined, "task-hello");
      store.recordError("task-hello", "TASK", "short-id");

      const record = store.getRuns({ last: 1 })[0];
      expect(record.nodeId).toBe(taskId);
      expect(record.parentId).toBe(taskId);
      expect(record.rootId).toBeNull();
      const emission = store.getEmissions({ last: 1 })[0];
      expect(emission.eventId).toBe(dummyAppIds.event("evt-hello"));
      expect(emission.emitterId).toBe(taskId);
      expect(store.getErrors({ last: 1 })[0].sourceId).toBe(taskId);
    });
  });
});
