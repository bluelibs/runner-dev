import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { graphql } from "graphql";
import { createApm, summarizeTasks } from "../../resources/live/apm";
import type { RunRecord } from "../../resources/live/types";
import { schema } from "../../schema";

const sample = (
  durationMs: number,
  overrides: Partial<RunRecord> = {}
): RunRecord => ({
  sequence: 1,
  timestampMs: 100_000,
  nodeId: "app.task",
  nodeKind: "TASK",
  durationMs,
  ok: true,
  ...overrides,
});

describe("task APM", () => {
  it("is opt-in and groups tasks and hooks separately", () => {
    const disabled = createApm(undefined);
    disabled.record(sample(10));
    expect(disabled.snapshot(30, "all", 100_000)).toMatchObject({
      enabled: false,
      storage: "disabled",
      retainedSamples: 0,
      tasks: [],
    });
    const enabled = createApm({ storage: "memory" });
    enabled.record(sample(10, { nodeKind: "HOOK" }));
    expect(enabled.snapshot(30, "all", 100_000)).toMatchObject({
      retainedSamples: 1,
      tasks: [],
      hooks: [{ hookId: "app.task", count: 1, p95Ms: 10 }],
    });
  });

  it("calculates nearest-rank tail latency and failure rate from all completed calls", () => {
    const runs = Array.from({ length: 100 }, (_, i) =>
      sample(i + 1, { ok: i !== 99 })
    );
    expect(summarizeTasks(runs)).toEqual([
      {
        taskId: "app.task",
        count: 100,
        failures: 1,
        errorRate: 0.01,
        meanMs: 50.5,
        p50Ms: 50,
        p95Ms: 95,
        p99Ms: 99,
        maxMs: 100,
      },
    ]);
    expect(summarizeTasks([sample(0.25)])[0].p99Ms).toBe(0.25);
    expect(summarizeTasks([])).toEqual([]);
  });

  it("bounds history independently and filters windows and call scopes", () => {
    const apm = createApm({ storage: "memory", maxSamples: 3 });
    apm.record(sample(1));
    apm.record(sample(2, { timestampMs: 39_999 }));
    apm.record(sample(3, { parentId: "app.parent" }));
    apm.record(sample(4, { timestampMs: 100_001 }));
    expect(apm.snapshot(1, "all", 100_000)).toMatchObject({
      retainedSamples: 3,
      oldestTimestampMs: 39_999,
      tasks: [{ count: 1, p95Ms: 3 }],
    });
    expect(apm.snapshot(1, "direct", 100_000).tasks).toEqual([]);
    expect(apm.snapshot(30, "nested", 100_000).tasks[0].count).toBe(1);
    expect(apm.snapshot(30, "direct", 100_000).tasks[0].p95Ms).toBe(2);
  });

  it("rejects invalid settings and durations", () => {
    expect(() => createApm({ maxSamples: 0 })).toThrow();
    expect(() => createApm({ sqliteFile: " " })).toThrow();
    const apm = createApm({ storage: "memory" });
    expect(() => apm.snapshot(0)).toThrow("windowMinutes");
    expect(() => apm.snapshot(525601)).toThrow("windowMinutes");
    expect(() => apm.record(sample(NaN))).toThrow("duration");
    expect(() => apm.record(sample(-1))).toThrow("duration");
  });

  it("restores SQLite samples, resumes sequences and lowers the cap across restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "apm-"));
    const config = { sqliteFile: join(directory, "apm.sqlite"), maxSamples: 3 };
    try {
      const first = createApm(config);
      first.record(sample(10, { error: "sensitive", correlationId: "secret" }));
      first.record(sample(20));
      first.record(
        sample(30, {
          nodeKind: "HOOK",
          nodeId: "app.hook",
          ok: false,
          parentId: "parent",
        })
      );
      first.close();
      const second = createApm({ ...config, maxSamples: 2 });
      try {
        expect(second.snapshot(30, "all", 100_000)).toMatchObject({
          storage: "sqlite",
          retainedSamples: 2,
          tasks: [{ count: 1, failures: 0, p95Ms: 20 }],
          hooks: [{ hookId: "app.hook", count: 1, failures: 1, p95Ms: 30 }],
        });
        second.record(sample(40));
        expect(second.snapshot(30, "all", 100_000).tasks[0].meanMs).toBe(40);
      } finally {
        second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exposes APM through GraphQL and rejects invalid windows", async () => {
    const apm = createApm({ storage: "memory" });
    apm.record(sample(42, { timestampMs: Date.now() }));
    apm.record(
      sample(65, {
        nodeKind: "HOOK",
        nodeId: "app.react",
        timestampMs: Date.now(),
      })
    );
    const contextValue = { live: { getApm: apm.snapshot } };
    const result = await graphql({
      schema,
      source:
        "{ live { apm(scope: direct, windowMinutes: 5) { enabled storage tasks { taskId p95Ms count } hooks { hookId p99Ms count } } } }",
      contextValue,
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      live: {
        apm: {
          enabled: true,
          storage: "memory",
          tasks: [{ p95Ms: 42, count: 1 }],
          hooks: [{ hookId: "app.react", p99Ms: 65, count: 1 }],
        },
      },
    });
    const invalid = await graphql({
      schema,
      source: "{ live { apm(windowMinutes: 0) { enabled } } }",
      contextValue,
    });
    expect(invalid.errors?.[0].message).toContain("windowMinutes");
  });
});
