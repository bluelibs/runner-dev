import { initializeApm } from "../../resources/live/initializeApm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApm } from "../../resources/live/apm";
import type { RunRecord } from "../../resources/live/types";

const sample = (timestampMs: number): RunRecord => ({
  sequence: 1,
  timestampMs,
  nodeId: "work",
  nodeKind: "TASK",
  durationMs: 10,
  ok: true,
});

it("accepts larger sample budgets and longer query windows while preserving defaults", () => {
  const large = createApm({ storage: "memory", maxSamples: 2_000_000 });
  large.record(sample(Date.now() - 2 * 86_400_000));
  expect(large.snapshot(7 * 1440).tasks[0].count).toBe(1);
  expect(large.snapshot(1440).tasks).toEqual([]);
  expect(createApm({ storage: "memory" }).snapshot().maxSamples).toBe(10_000);
  expect(() =>
    createApm({ storage: "memory", maxSamples: 10_000_001 })
  ).toThrow();
});

it("applies a cutoff date and sliding retention using the stricter boundary", () => {
  const now = Date.now();
  const apm = createApm({
    storage: "memory",
    retentionDays: 7,
    cutoffDate: new Date(now - 2 * 86_400_000).toISOString(),
  });
  apm.record(sample(now - 3 * 86_400_000));
  apm.record(sample(now - 86_400_000));
  expect(apm.snapshot(7 * 1440, "all", now)).toMatchObject({
    retainedSamples: 1,
    cutoffTimestampMs: now - 2 * 86_400_000,
  });
  expect(apm.snapshot(7 * 1440, "all", now + 8 * 86_400_000)).toMatchObject({
    retainedSamples: 0,
    tasks: [],
  });
  expect(() => createApm({ cutoffDate: "yesterday" })).toThrow();
  expect(() => createApm({ retentionDays: 0 })).toThrow();
});

it("prunes expired SQLite samples before restoration and preserves sequence progress", async () => {
  const directory = mkdtempSync(join(tmpdir(), "apm-retention-"));
  const file = join(directory, "apm.sqlite");
  const now = Date.now();
  try {
    const original = await initializeApm({ sqliteFile: file });
    original.record(sample(now - 3 * 86_400_000));
    original.record(sample(now));
    await original.close();
    const restored = await initializeApm({
      sqliteFile: file,
      cutoffDate: new Date(now - 86_400_000).toISOString(),
    });
    expect(restored.snapshot().retainedSamples).toBe(1);
    restored.record(sample(now + 1));
    expect(restored.snapshot(30, "all", now + 2).tasks[0].count).toBe(2);
    await restored.close();
    const after = await initializeApm({ sqliteFile: file });
    expect(after.snapshot().retainedSamples).toBe(2);
    await after.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
