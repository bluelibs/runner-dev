import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sqlitePersistence } from "../../resources/live/sqlitePersistence";
import { sqliteApmPersistence } from "../../resources/live/sqliteApmPersistence";
import type { RunRecord } from "../../resources/live/types";

const sample: RunRecord = {
  sequence: 1,
  timestampMs: 1,
  nodeId: "task",
  nodeKind: "TASK",
  durationMs: 1,
  ok: true,
};

// Holding the write lock forces SQLite to wait. A main-thread database call would
// prevent the release timer from running until busy_timeout expires and the write fails.
async function writeWhileLocked(file: string, flush: () => Promise<void>) {
  const lock = new DatabaseSync(file);
  let released = false;
  lock.exec("BEGIN IMMEDIATE");
  const timer = setTimeout(() => {
    lock.exec("ROLLBACK");
    released = true;
  }, 100);
  try {
    await flush();
    expect(released).toBe(true);
  } finally {
    clearTimeout(timer);
    if (!released) lock.exec("ROLLBACK");
    lock.close();
  }
}

describe("SQLite worker isolation", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "runner-dev-worker-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("live writes wait for SQLite locks without blocking the application timer", async () => {
    const file = join(directory, "live.sqlite");
    const store = sqlitePersistence({ file });
    try {
      await store.load({ maxEntries: 2 });
      store.append(
        {
          kind: "log",
          entry: {
            sequence: 1,
            timestampMs: 1,
            level: "info",
            message: "queued",
          },
        },
        { maxEntries: 2 }
      );
      expect(store.status().pendingEntries).toBe(1);
      await writeWhileLocked(file, store.flush);
      expect(store.status()).toEqual({ pendingEntries: 0, error: null });
      expect((await store.load({ maxEntries: 2 })).entries).toHaveLength(1);
    } finally {
      await store.close();
    }
  });

  test("APM writes wait for SQLite locks without blocking the application timer", async () => {
    const file = join(directory, "apm.sqlite");
    const store = sqliteApmPersistence(file);
    try {
      await store.load({ maxSamples: 2 });
      store.append(sample);
      await writeWhileLocked(file, store.flush);
      expect(store.status()).toEqual({ pendingSamples: 0, error: null });
      expect((await store.load({ maxSamples: 2 })).samples).toEqual([
        { ...sample, parentId: null },
      ]);
    } finally {
      await store.close();
    }
  });

  test("queued live snapshots are immutable and shutdown drains without an explicit flush", async () => {
    const file = join(directory, "snapshot.sqlite");
    const store = sqlitePersistence({ file });
    const data = { value: "before" };
    await store.load({ maxEntries: 2 });
    store.append(
      {
        kind: "log",
        entry: {
          sequence: 1,
          timestampMs: 1,
          level: "info",
          message: "immutable",
          data,
        },
      },
      { maxEntries: 2 }
    );
    data.value = "after";
    await store.close();
    const restored = sqlitePersistence({ file });
    try {
      expect(
        (await restored.load({ maxEntries: 2 })).entries[0].entry
      ).toMatchObject({ data: { value: "before" } });
    } finally {
      await restored.close();
    }
  });

  test("the live queue is bounded and rejected entries do not advance its cursor", async () => {
    const file = join(directory, "bounded.sqlite");
    const store = sqlitePersistence({ file });
    try {
      await store.load({ maxEntries: 1 });
      for (let sequence = 1; sequence <= 10_000; sequence++) {
        store.append(
          {
            kind: "log",
            entry: {
              sequence,
              timestampMs: sequence,
              level: "info",
              message: "bounded",
            },
          },
          { maxEntries: 1 }
        );
      }
      const next = {
        kind: "run" as const,
        entry: { ...sample, sequence: 10_001 },
      };
      expect(() => store.append(next, { maxEntries: 1 })).toThrow(
        "queue is full"
      );
      await store.flush();
      store.append(next, { maxEntries: 1 });
      expect((await store.load({ maxEntries: 1 })).lastSequence).toBe(10_001);
    } finally {
      await store.close();
    }
  });

  test("load must complete before either store accepts new writes", async () => {
    const live = sqlitePersistence({ file: ":memory:" });
    const apm = sqliteApmPersistence(":memory:");
    try {
      const liveLoad = live.load({ maxEntries: 2 });
      const apmLoad = apm.load({ maxSamples: 2 });
      expect(() =>
        live.append({ kind: "run", entry: sample }, { maxEntries: 2 })
      ).toThrow("restoration");
      expect(() => apm.append(sample)).toThrow("restoration");
      await Promise.all([liveLoad, apmLoad]);
    } finally {
      await Promise.all([live.close(), apm.close()]);
    }
  });
});
