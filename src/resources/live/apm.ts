import z from "zod";
import { RingBuffer } from "./RingBuffer";
import { createSequenceClock } from "./sequenceClock";
import { sqlitePersistence, type SQLitePersistence } from "./sqlitePersistence";
import type { RunRecord } from "./types";

export const apmConfigSchema = z.union([
  z.boolean(),
  z
    .object({
      maxSamples: z.number().int().positive().max(1_000_000).optional(),
      sqliteFile: z.string().trim().min(1).optional(),
      storage: z.enum(["auto", "memory"]).optional(),
    })
    .strict(),
]);
export type ApmConfig =
  | boolean
  | {
      maxSamples?: number;
      sqliteFile?: string;
      storage?: "auto" | "memory";
    };
export type ApmScope = "all" | "direct" | "nested";
export interface TaskPerformance {
  taskId: string;
  count: number;
  failures: number;
  errorRate: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}
export interface ApmSnapshot {
  enabled: boolean;
  storage: string;
  maxSamples: number;
  retainedSamples: number;
  windowMinutes: number;
  scope: ApmScope;
  oldestTimestampMs: number | null;
  tasks: TaskPerformance[];
}

export function summarizeTasks(samples: RunRecord[]): TaskPerformance[] {
  const groups = new Map<string, RunRecord[]>();
  for (const sample of samples) {
    const group = groups.get(sample.nodeId) ?? [];
    group.push(sample);
    groups.set(sample.nodeId, group);
  }
  return Array.from(groups, ([taskId, runs]) => {
    const durations = runs.map((run) => run.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    const percentile = (p: number) => durations[Math.ceil(p * count) - 1];
    const failures = runs.filter((run) => !run.ok).length;
    return {
      taskId,
      count,
      failures,
      errorRate: failures / count,
      meanMs: durations.reduce((sum, value) => sum + value, 0) / count,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: durations[count - 1],
    };
  }).sort((a, b) => b.p95Ms - a.p95Ms || a.taskId.localeCompare(b.taskId));
}

/** Separate bounded samples prevent trace retention from biasing APM queries. */
export function createApm(config: ApmConfig | undefined) {
  const parsed = config === undefined ? false : apmConfigSchema.parse(config);
  const enabled = parsed !== false;
  const options = typeof parsed === "object" ? parsed : {};
  const maxSamples = options.maxSamples ?? 10_000;
  const samples = new RingBuffer<RunRecord>(maxSamples);
  let persistence: SQLitePersistence | undefined;
  let lastSequence = 0;
  if (enabled && options.storage !== "memory") {
    try {
      persistence = sqlitePersistence({
        file: options.sqliteFile ?? "./.runner-dev/apm.sqlite",
      });
      const snapshot = persistence.load({ maxEntries: maxSamples });
      lastSequence = snapshot.lastSequence;
      for (const record of snapshot.entries) {
        if (record.kind === "run" && record.entry.nodeKind === "TASK")
          samples.push(record.entry);
      }
    } catch (error) {
      persistence?.close();
      persistence = undefined;
      // Only an unavailable builtin warrants fallback; disk errors must be visible.
      if (
        !(error instanceof Error) ||
        !(error.cause instanceof Error) ||
        !("code" in error.cause) ||
        error.cause.code !== "ERR_UNKNOWN_BUILTIN_MODULE"
      )
        throw error;
    }
  }
  const nextSequence = createSequenceClock(lastSequence);
  return {
    record(run: RunRecord) {
      if (!enabled || run.nodeKind !== "TASK") return;
      if (!Number.isFinite(run.durationMs) || run.durationMs < 0)
        throw new Error("APM duration must be finite and non-negative.");
      // No inputs, outputs, error messages or correlation data are persisted for APM.
      const sample: RunRecord = {
        sequence: nextSequence(run.timestampMs),
        timestampMs: run.timestampMs,
        nodeId: run.nodeId,
        nodeKind: "TASK",
        durationMs: run.durationMs,
        ok: run.ok,
        parentId: run.parentId ? "nested" : null,
      };
      persistence?.append(
        { kind: "run", entry: sample },
        { maxEntries: maxSamples }
      );
      samples.push(sample);
    },
    snapshot(
      windowMinutes = 30,
      scope: ApmScope = "all",
      now = Date.now()
    ): ApmSnapshot {
      if (
        !Number.isInteger(windowMinutes) ||
        windowMinutes < 1 ||
        windowMinutes > 1440
      )
        throw new Error(
          "APM windowMinutes must be an integer between 1 and 1440."
        );
      if (!["all", "direct", "nested"].includes(scope))
        throw new Error("Invalid APM scope.");
      const selected: RunRecord[] = [];
      for (let i = 0; i < samples.size; i++) {
        const run = samples.at(i);
        if (
          run.timestampMs < now - windowMinutes * 60_000 ||
          run.timestampMs > now
        )
          continue;
        if (scope === "direct" && run.parentId) continue;
        if (scope === "nested" && !run.parentId) continue;
        selected.push(run);
      }
      return {
        enabled,
        storage: !enabled ? "disabled" : persistence ? "sqlite" : "memory",
        maxSamples,
        retainedSamples: samples.size,
        windowMinutes,
        scope,
        oldestTimestampMs: samples.size ? samples.at(0).timestampMs : null,
        tasks: summarizeTasks(selected),
      };
    },
    close() {
      persistence?.close();
    },
  };
}
