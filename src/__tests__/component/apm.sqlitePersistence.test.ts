import { sqliteApmPersistence } from "../../resources/live/sqliteApmPersistence";
import { sqlitePersistence } from "../../resources/live/sqlitePersistence";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunRecord } from "../../resources/live/types";
const sample = (sequence: number, timestampMs = Date.now()): RunRecord => ({
  sequence,
  timestampMs,
  nodeId: "é".repeat(75000),
  nodeKind: "HOOK",
  durationMs: 1,
  ok: true,
  error: "secret",
  correlationId: "private",
});
it("migrates old SQLite samples, strips private fields and preserves evicted sequence metadata", async () => {
  const directory = mkdtempSync(join(tmpdir(), "apm-migration-")),
    file = join(directory, "apm.sqlite");
  try {
    const legacy = sqlitePersistence({ file });
    legacy.append({ kind: "run", entry: sample(1) }, { maxEntries: 5 });
    legacy.append({ kind: "run", entry: sample(2) }, { maxEntries: 5 });
    legacy.close();
    const store = sqliteApmPersistence(file);
    const restored = store.load({ maxSamples: 1 });
    expect(restored.lastSequence).toBe(2);
    expect(restored.samples).toHaveLength(1);
    expect(restored.samples[0].error).toBeUndefined();
    await store.close();
    const after = sqliteApmPersistence(file);
    expect(after.load({ maxSamples: 100 }).samples).toHaveLength(1);
    await after.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it("flushes compact samples and applies time, bytes and count limits in one transaction", async () => {
  const store = sqliteApmPersistence(":memory:");
  store.load({ maxSamples: 5, maxStorage: 524288, retentionDays: 7 });
  for (let index = 1; index <= 6; index++)
    store.append(
      sample(index, index === 1 ? Date.now() - 8 * 86400000 : Date.now())
    );
  expect(store.status().pendingSamples).toBe(6);
  await store.flush();
  const snapshot = store.load({
    maxSamples: 5,
    maxStorage: 524288,
    retentionDays: 7,
  });
  expect(snapshot.samples.map((run) => run.sequence)).toEqual([4, 5, 6]);
  expect(
    snapshot.samples.every((run) => !run.error && !run.correlationId)
  ).toBe(true);
  expect(snapshot.lastSequence).toBe(6);
  await store.close();
});
it("rolls back a whole batch on sequence conflicts and exposes the failure", async () => {
  const store = sqliteApmPersistence(":memory:");
  store.load({ maxSamples: 10 });
  store.append(sample(2));
  store.append(sample(1));
  await expect(store.flush()).rejects.toThrow("sequences must increase");
  expect(store.status().error).toContain("sequences must increase");
  await expect(store.close()).rejects.toThrow("sequences must increase");
});
