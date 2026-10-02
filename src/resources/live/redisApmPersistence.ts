import type { RunRecord } from "./types";
import { apmRetentionSchema } from "./apmRetention";
import { compactApmSample } from "./apmSample";
import { createHash } from "node:crypto";
import z from "zod";
import type Redis from "ioredis";
import { bufferedApmWriter } from "./bufferedApmWriter";
import { REDIS_APM_SCRIPT } from "./redisApm.script";
import type { ApmPersistence, ApmRetention } from "./apmPersistence";
import { parsePersistedEntry } from "./persistence.schema";
export const redisApmConfigSchema = z
  .object({
    url: z.string().url(),
    streamId: z.string().min(1),
    keyPrefix: z
      .string()
      .regex(/^[A-Za-z0-9:_-]+$/)
      .optional(),
    batchSize: z.number().int().positive().max(10_000).optional(),
    maxPendingSamples: z.number().int().positive().max(1_000_000).optional(),
    flushIntervalMs: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict();
export interface RedisApmPersistenceOptions {
  url: string;
  streamId: string;
  keyPrefix?: string;
  batchSize?: number;
  maxPendingSamples?: number;
  flushIntervalMs?: number;
  timeoutMs?: number;
}
export interface RedisApmPersistence extends ApmPersistence {
  close(): Promise<void>;
}
export async function redisApmPersistence(
  options: RedisApmPersistenceOptions
): Promise<RedisApmPersistence> {
  const config = redisApmConfigSchema.parse(options),
    url = new URL(config.url);
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Redis APM requires a redis(s) URL without credentials; use REDIS_USERNAME/REDIS_PASSWORD."
    );
  if ((config.maxPendingSamples ?? 10_000) < (config.batchSize ?? 1000))
    throw new Error("Redis maxPendingSamples must be at least batchSize.");
  let RedisConstructor: typeof Redis;
  try {
    // Optional provider dependency must never load with the package entry.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule: typeof import("ioredis") = require("ioredis");
    RedisConstructor = redisModule.Redis;
  } catch (cause) {
    throw new Error(
      "Redis APM persistence requires the optional ioredis package.",
      { cause }
    );
  }
  const client = new RedisConstructor(config.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: config.timeoutMs ?? 10_000,
    commandTimeout: config.timeoutMs ?? 10_000,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  });
  // The writer surfaces failures; observing error events prevents an unhandled event.
  client.on("error", () => {});
  try {
    await client.connect();
  } catch (error) {
    client.disconnect();
    throw error;
  }
  const tag = createHash("sha256").update(config.streamId).digest("hex");
  const prefix = `${config.keyPrefix ?? "runner-dev:apm"}:{${tag}}`;
  const keys = ["entries", "data", "times", "meta"].map(
    (name) => `${prefix}:${name}`
  );
  let policy: ApmRetention = { maxSamples: 10_000 };
  async function execute(records: unknown[], limit: number) {
    const cutoff = Math.max(
      policy.cutoffTimestampMs ?? -Infinity,
      policy.retentionDays
        ? Date.now() - policy.retentionDays * 86_400_000
        : -Infinity
    );
    return client.eval(
      REDIS_APM_SCRIPT,
      4,
      ...keys,
      JSON.stringify(records),
      Number.isFinite(cutoff) ? String(cutoff) : "",
      String(policy.maxSamples),
      String(policy.maxStorage ?? 0),
      String(limit),
      String(
        policy.retentionDays ? Math.ceil(policy.retentionDays * 86_400_000) : 0
      )
    );
  }
  const writer = bufferedApmWriter(async (samples) => {
    await execute(
      samples.map((sample) => ({
        sequence: String(sample.sequence),
        timestampMs: sample.timestampMs,
        record: JSON.stringify(sample),
      })),
      0
    );
  }, config);
  return {
    storage: "redis",
    append(sample: RunRecord) {
      return writer.append(compactApmSample(sample, policy.maxStorage));
    },
    flush: writer.flush,
    status: writer.status,
    async load(options) {
      writer.assertReady();
      await writer.flush();
      policy = apmRetentionSchema.parse(options);
      const result = z
        .tuple([
          z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
          z.array(z.string()),
        ])
        .parse(await execute([], options.maxSamples));
      const samples = result[1]
        .map((record) => {
          const entry = parsePersistedEntry({
            kind: "run",
            entry: JSON.parse(record),
          });
          if (entry.kind !== "run")
            throw new Error("Invalid Redis APM sample.");
          return entry.entry;
        })
        .reverse();
      return { samples, lastSequence: result[0] };
    },
    async close() {
      try {
        await writer.close();
      } finally {
        client.disconnect();
      }
    },
  };
}
