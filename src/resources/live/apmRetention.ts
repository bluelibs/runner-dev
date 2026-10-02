import z from "zod";
import { MIN_STORAGE_BYTES } from "./storageSize";
import type { ApmConfig } from "./apm";
import { parseStorageSize } from "./storageSize";
export function resolveApmRetention(
  config: ApmConfig | undefined,
  now = Date.now()
) {
  const options = typeof config === "object" ? config : {};
  const maxStorage =
    options.maxStorage === undefined
      ? undefined
      : parseStorageSize(options.maxStorage);
  const cutoffTimestampMs = Math.max(
    options.cutoffDate ? Date.parse(options.cutoffDate) : -Infinity,
    options.retentionDays ? now - options.retentionDays * 86_400_000 : -Infinity
  );
  return {
    maxSamples: options.maxSamples ?? (maxStorage ? 10_000_000 : 10_000),
    maxStorage,
    retentionDays: options.retentionDays,
    cutoffTimestampMs: Number.isFinite(cutoffTimestampMs)
      ? cutoffTimestampMs
      : undefined,
  };
}

export const apmRetentionSchema = z
  .object({
    maxSamples: z.number().int().positive().max(10_000_000),
    maxStorage: z.number().int().safe().min(MIN_STORAGE_BYTES).optional(),
    retentionDays: z.number().positive().max(3650).optional(),
    cutoffTimestampMs: z.number().finite().optional(),
  })
  .strict();
