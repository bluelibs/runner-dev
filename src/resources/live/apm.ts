import z from "zod";
import { storageSizeSchema, type StorageSize } from "./storageSize";
import { resolveApmRetention } from "./apmRetention";
import { RingBuffer } from "./RingBuffer";
import { createSequenceClock } from "./sequenceClock";
import {
  apmPersistenceSourceSchema,
  enqueueApmSample,
  type ApmPersistence,
  type ApmPersistenceSource,
} from "./apmPersistence";
import { validatePersistenceSnapshot } from "./persistence.schema";
import type { RunRecord } from "./types";

export const apmConfigSchema = z.union([
  z.boolean(),
  z
    .object({
      maxStorage: storageSizeSchema.optional(),
      maxSamples: z.number().int().positive().max(10_000_000).optional(),
      sqliteFile: z.string().trim().min(1).optional(),
      storage: z.enum(["auto", "memory"]).optional(),
      persistence: apmPersistenceSourceSchema.optional(),
      retentionDays: z.number().positive().max(3650).optional(),
      cutoffDate: z.string().datetime({ offset: true }).optional(),
    })
    .strict()
    .superRefine((options, context) => {
      if (
        options.persistence &&
        (options.storage === "memory" || options.sqliteFile)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "APM persistence cannot be combined with memory storage or sqliteFile.",
        });
      }
    }),
]);
export type ApmConfig =
  | boolean
  | {
      maxStorage?: StorageSize;
      maxSamples?: number;
      sqliteFile?: string;
      storage?: "auto" | "memory";
      persistence?: ApmPersistenceSource;
      retentionDays?: number;
      cutoffDate?: string;
    };
export type ApmScope = "all" | "direct" | "nested";
export interface PerformanceMetrics {
  count: number;
  failures: number;
  errorRate: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}
export interface TaskPerformance extends PerformanceMetrics {
  taskId: string;
}
export interface HookPerformance extends PerformanceMetrics {
  hookId: string;
}
export interface ApmSnapshot {
  cutoffTimestampMs?: number | null;
  pendingSamples?: number;
  persistenceError?: string | null;
  enabled: boolean;
  storage: string;
  maxSamples: number;
  maxStorage?: number | null;
  retainedBytes?: number;
  retainedSamples: number;
  windowMinutes: number;
  scope: ApmScope;
  oldestTimestampMs: number | null;
  tasks: TaskPerformance[];
  hooks: HookPerformance[];
}

function summarizeRuns(samples: RunRecord[]) {
  const groups = new Map<string, RunRecord[]>();
  for (const sample of samples) {
    const group = groups.get(sample.nodeId) ?? [];
    group.push(sample);
    groups.set(sample.nodeId, group);
  }
  return Array.from(groups, ([nodeId, runs]) => {
    const durations = runs.map((run) => run.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    const percentile = (p: number) => durations[Math.ceil(p * count) - 1];
    const failures = runs.filter((run) => !run.ok).length;
    return {
      nodeId,
      count,
      failures,
      errorRate: failures / count,
      meanMs: durations.reduce((sum, value) => sum + value, 0) / count,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: durations[count - 1],
    };
  }).sort((a, b) => b.p95Ms - a.p95Ms || a.nodeId.localeCompare(b.nodeId));
}

export function summarizeTasks(samples: RunRecord[]): TaskPerformance[] {
  return summarizeRuns(samples.filter((run) => run.nodeKind === "TASK")).map(
    ({ nodeId, ...metrics }) => ({ taskId: nodeId, ...metrics })
  );
}
export function summarizeHooks(samples: RunRecord[]): HookPerformance[] {
  return summarizeRuns(samples.filter((run) => run.nodeKind === "HOOK")).map(
    ({ nodeId, ...metrics }) => ({ hookId: nodeId, ...metrics })
  );
}

/** Separate bounded samples prevent trace retention from biasing APM queries. */
export function createApm(
  config: ApmConfig | undefined,
  remote?: ApmPersistence,
  restored?: { samples: RunRecord[]; lastSequence: number },
  closePersistence?: () => Promise<void>
) {
  const parsed = config === undefined ? false : apmConfigSchema.parse(config);
  const enabled = parsed !== false;
  const options = typeof parsed === "object" ? parsed : {};
  const policy = resolveApmRetention(config);
  const maxSamples = policy.maxSamples;
  const maxStorage = policy.maxStorage;
  let retainedBytes = 0;
  const sizes = new Map<number, number>();
  const storeSample = (sample: RunRecord) => {
    const bytes = maxStorage ? Buffer.byteLength(JSON.stringify(sample)) : 0;
    if (maxStorage && bytes > maxStorage)
      throw new Error("APM sample exceeds maxStorage.");
    if (samples.size === maxSamples) {
      const oldest = samples.at(0);
      retainedBytes -= sizes.get(oldest.sequence) ?? 0;
      sizes.delete(oldest.sequence);
    }
    samples.push(sample);
    if (maxStorage) {
      sizes.set(sample.sequence, bytes);
      retainedBytes += bytes;
      while (retainedBytes > maxStorage) {
        const oldest = samples.shift();
        if (!oldest) break;
        retainedBytes -= sizes.get(oldest.sequence) ?? 0;
        sizes.delete(oldest.sequence);
      }
    }
  };
  let samples = new RingBuffer<RunRecord>(maxSamples);
  const lastSequence = restored?.lastSequence ?? 0;
  if (restored)
    validatePersistenceSnapshot({
      entries: restored.samples.map((entry) => ({ kind: "run", entry })),
      lastSequence: restored.lastSequence,
    });
  for (const sample of restored?.samples ?? []) {
    if (sample.durationMs < 0)
      throw new Error("Invalid persisted APM duration.");
    storeSample(sample);
  }
  if (options.persistence && !remote)
    throw new Error("APM persistence provider was not initialized.");
  const cutoff = (now: number) =>
    Math.max(
      options.cutoffDate ? Date.parse(options.cutoffDate) : -Infinity,
      options.retentionDays
        ? now - options.retentionDays * 86_400_000
        : -Infinity
    );
  const nextSequence = createSequenceClock(lastSequence);
  return {
    record(run: RunRecord) {
      if (!enabled) return;
      if (!Number.isFinite(run.durationMs) || run.durationMs < 0)
        throw new Error("APM duration must be finite and non-negative.");
      // No inputs, outputs, error messages or correlation data are persisted for APM.
      const sample: RunRecord = {
        sequence: nextSequence(run.timestampMs),
        timestampMs: run.timestampMs,
        nodeId: run.nodeId,
        nodeKind: run.nodeKind,
        durationMs: run.durationMs,
        ok: run.ok,
        parentId: run.parentId ? "nested" : null,
      };
      if (sample.timestampMs < cutoff(Date.now())) return;
      if (maxStorage && Buffer.byteLength(JSON.stringify(sample)) > maxStorage)
        throw new Error("APM sample exceeds maxStorage.");
      if (remote) enqueueApmSample(remote, sample);
      storeSample(sample);
    },
    snapshot(
      windowMinutes = 30,
      scope: ApmScope = "all",
      now = Date.now()
    ): ApmSnapshot {
      if (
        !Number.isInteger(windowMinutes) ||
        windowMinutes < 1 ||
        windowMinutes > 525600
      )
        throw new Error(
          "APM windowMinutes must be an integer between 1 and 525600."
        );
      if (!["all", "direct", "nested"].includes(scope))
        throw new Error("Invalid APM scope.");
      const retentionCutoff = cutoff(now);
      if (Number.isFinite(retentionCutoff)) {
        const retained = new RingBuffer<RunRecord>(maxSamples);
        for (let i = 0; i < samples.size; i++) {
          const sample = samples.at(i);
          if (sample.timestampMs >= retentionCutoff) retained.push(sample);
        }
        samples = retained;
        retainedBytes = 0;
        sizes.clear();
        if (maxStorage)
          for (let i = 0; i < samples.size; i++) {
            const sample = samples.at(i);
            const bytes = Buffer.byteLength(JSON.stringify(sample));
            sizes.set(sample.sequence, bytes);
            retainedBytes += bytes;
          }
      }
      const selected: RunRecord[] = [];
      for (let i = 0; i < samples.size; i++) {
        const run = samples.at(i);
        if (
          run.timestampMs <
            Math.max(now - windowMinutes * 60_000, cutoff(now)) ||
          run.timestampMs > now
        )
          continue;
        if (scope === "direct" && run.parentId) continue;
        if (scope === "nested" && !run.parentId) continue;
        selected.push(run);
      }
      return {
        enabled,
        pendingSamples: remote?.status?.().pendingSamples ?? 0,
        persistenceError: remote?.status?.().error ?? null,
        cutoffTimestampMs: Number.isFinite(retentionCutoff)
          ? retentionCutoff
          : null,
        storage: !enabled ? "disabled" : remote?.storage ?? "memory",
        maxSamples,
        maxStorage: maxStorage ?? null,
        retainedBytes,
        retainedSamples: samples.size,
        windowMinutes,
        scope,
        oldestTimestampMs: samples.size ? samples.at(0).timestampMs : null,
        tasks: summarizeTasks(selected),
        hooks: summarizeHooks(selected),
      };
    },
    close() {
      return closePersistence ? closePersistence() : remote?.flush();
    },
  };
}
