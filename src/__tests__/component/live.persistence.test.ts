import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineResource, resources, run } from "@bluelibs/runner";
import { live } from "../../resources/live.resource";
import { sqlitePersistenceResource } from "../../resources/live/sqlitePersistence.resource";
import { sqlitePersistence } from "../../resources/live/sqlitePersistence";
import type {
  LivePersistence,
  LivePersistenceSource,
  LivePersistedEntry,
} from "../../resources/live/persistence";
import { runContext } from "../../resources/telemetry.chain";

function app(persistence: LivePersistenceSource, maxEntries = 3) {
  return defineResource({
    id: "persisted-app",
    register: [live.with({ persistence, maxEntries })],
  });
}

describe("live persistence", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "runner-dev-live-"));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  test("restores every category, metadata and cursors after restart with a backwards clock", async () => {
    const persistence = sqlitePersistenceResource.with({
      file: join(directory, "nested", "live.sqlite"),
    });
    const root = app(persistence);
    const runtime = await run(root);
    let savedSequence = 0;
    try {
      const store = await runtime.getResourceValue(live);
      const logger = await runtime.getResourceValue(resources.logger);
      await logger.info("persisted logger", { data: { attempt: 2 } });
      jest.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
      runContext.run(
        { chain: [], correlationId: "persisted-correlation" },
        () => {
          store.recordEmission("evt", { name: "Ada" }, "source");
          store.recordError("source", "TASK", new Error("persisted error"), {
            attempt: 3,
          });
          store.recordRun("task", "TASK", 7, false, "failed", "parent", "root");
        }
      );
      savedSequence = store.getRuns({ last: 1 })[0].sequence;
    } finally {
      await runtime.dispose();
    }
    jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const restarted = await run(root);
    try {
      const store = await restarted.getResourceValue(live);
      expect(
        store.getLogs({ messageIncludes: "persisted logger" })[0].data
      ).toMatchObject({ attempt: 2 });
      expect(store.getEmissions({ eventIds: ["evt"] })[0]).toMatchObject({
        payload: { name: "Ada" },
        emitterId: "source",
        correlationId: "persisted-correlation",
      });
      expect(
        store.getErrors({ messageIncludes: "persisted error" })[0]
      ).toMatchObject({
        sourceKind: "TASK",
        data: { attempt: 3 },
        correlationId: "persisted-correlation",
      });
      expect(store.getRuns({ nodeIds: ["task"] })[0]).toMatchObject({
        sequence: savedSequence,
        durationMs: 7,
        ok: false,
        error: "failed",
        parentId: "parent",
        rootId: "root",
        correlationId: "persisted-correlation",
      });
      store.recordRun("new-task", "TASK", 1, true);
      expect(
        store
          .getRuns({ afterSequence: savedSequence })
          .map((record) => record.nodeId)
      ).toEqual(["new-task"]);
    } finally {
      await restarted.dispose();
    }
  });

  test("commits immediately and caps disk and memory per category, including a smaller cap on reopen", async () => {
    const persistence = sqlitePersistenceResource.with({
      file: join(directory, "live.sqlite"),
    });
    const runtime = await run(app(persistence));
    try {
      const store = await runtime.getResourceValue(live);
      for (let index = 0; index < 5; index++) {
        store.recordLog("info", `entry-${index}`);
        store.recordEmission(`entry-${index}`);
        store.recordError("source", "INTERNAL", `entry-${index}`);
        store.recordRun(`entry-${index}`, "HOOK", 1, true);
      }
      const reader = sqlitePersistence(persistence.config);
      try {
        const entries = reader.load({ maxEntries: 3 }).entries;
        for (const kind of ["log", "emission", "error", "run"]) {
          expect(entries.filter((record) => record.kind === kind)).toHaveLength(
            3
          );
        }
      } finally {
        await reader.close();
      }
      expect(store.getLogs().map((record) => record.message)).toEqual([
        "entry-2",
        "entry-3",
        "entry-4",
      ]);
    } finally {
      await runtime.dispose();
    }
    const reopened = sqlitePersistence(persistence.config);
    try {
      const snapshot = reopened.load({ maxEntries: 1 });
      expect(snapshot.entries).toHaveLength(4);
      expect(snapshot.entries.map((record) => record.entry.sequence)).toEqual(
        [...snapshot.entries.map((record) => record.entry.sequence)].sort(
          (a, b) => a - b
        )
      );
    } finally {
      await reopened.close();
    }
    const restarted = await run(app(persistence, 1));
    try {
      const store = await restarted.getResourceValue(live);
      expect(store.getEmissions().map((record) => record.eventId)).toEqual([
        "entry-4",
      ]);
      expect(store.getErrors().map((record) => record.message)).toEqual([
        "entry-4",
      ]);
      expect(store.getRuns().map((record) => record.nodeId)).toEqual([
        "entry-4",
      ]);
    } finally {
      await restarted.dispose();
    }
  });

  test("supports a custom adapter, publishes only committed records and closes on disposal", async () => {
    const entries: LivePersistedEntry[] = [];
    const close = jest.fn();
    const append = jest.fn((record: LivePersistedEntry): undefined => {
      entries.push(record);
    });
    const load = jest.fn(() => ({ entries, lastSequence: 0 }));
    const provider = defineResource({
      id: "custom-persistence",
      async init(): Promise<LivePersistence> {
        return { load, append };
      },
      async dispose() {
        close();
      },
    });
    const runtime = await run(app(provider));
    const store = await runtime.getResourceValue(live);
    try {
      expect(load).toHaveBeenCalledWith({ maxEntries: 3 });
      const listener = jest.fn(() => expect(append).toHaveBeenCalled());
      store.onRecord(listener);
      store.recordRun("committed", "TASK", 1, true);
      expect(listener).toHaveBeenCalledWith("run");
      append.mockImplementationOnce(() => {
        throw new Error("disk full");
      });
      expect(() => store.recordRun("failed-write", "TASK", 1, true)).toThrow(
        "disk full"
      );
      expect(store.getRuns().map((record) => record.nodeId)).toEqual([
        "committed",
      ]);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      await runtime.dispose();
    }
    expect(close).toHaveBeenCalledTimes(1);
    expect(() => store.recordRun("closed", "TASK", 1, true)).toThrow("closed");
  });

  test("closes an adapter when restore fails and rejects invalid saved cursors", async () => {
    const close = jest.fn();
    await expect(
      run(
        app(
          defineResource({
            id: "invalid-restore-persistence",
            async init(): Promise<LivePersistence> {
              return {
                load: () => ({ entries: [], lastSequence: -1 }),
                append: () => {},
              };
            },
            async dispose() {
              close();
            },
          })
        )
      )
    ).rejects.toThrow();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("snapshots circular payloads, bigint, errors and functions without dropping entries", async () => {
    const persistence = sqlitePersistenceResource.with({
      file: join(directory, "live.sqlite"),
    });
    const session = sqlitePersistence(persistence.config);
    const data: Record<string, unknown> = {
      count: 4n,
      error: new Error("inner"),
      callback: () => {},
      symbol: Symbol("x"),
    };
    data.self = data;
    try {
      session.append(
        {
          kind: "log",
          entry: {
            sequence: 1,
            timestampMs: 1,
            level: "info",
            message: "shapes",
            data,
          },
        },
        { maxEntries: 3 }
      );
    } finally {
      await session.close();
    }
    const reopened = sqlitePersistence(persistence.config);
    try {
      expect(reopened.load({ maxEntries: 3 }).entries[0].entry).toMatchObject({
        data: {
          count: "4",
          error: { name: "Error", message: "inner" },
          self: "[Circular]",
          callback: "[Function]",
          symbol: "Symbol(x)",
        },
      });
    } finally {
      await reopened.close();
    }
  });
});
