import z from "zod";
import { compactApmSample } from "./apmSample";
import { bufferedApmWriter } from "./bufferedApmWriter";
import { clickHouseApmRetention } from "./clickHouseApmRetention";
import { apmRetentionSchema } from "./apmRetention";
import type { ApmPersistence } from "./apmPersistence";
import { parsePersistedEntry } from "./persistence.schema";

const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
export const clickHouseApmConfigSchema = z
  .object({
    url: z.string().url(),
    database: identifier.optional(),
    table: identifier.optional(),
    streamId: z.string().min(1),
    batchSize: z.number().int().positive().max(10_000).optional(),
    maxPendingSamples: z.number().int().positive().max(1_000_000).optional(),
    flushIntervalMs: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict();
export interface ClickHouseApmPersistenceOptions {
  url: string;
  streamId: string;
  database?: string;
  table?: string;
  batchSize?: number;
  maxPendingSamples?: number;
  flushIntervalMs?: number;
  timeoutMs?: number;
}
export interface ClickHouseApmPersistence extends ApmPersistence {
  close(): Promise<void>;
}

/** Credentials stay in environment variables, outside config and exported documentation. */
export async function clickHouseApmPersistence(
  options: ClickHouseApmPersistenceOptions
): Promise<ClickHouseApmPersistence> {
  const parsed = clickHouseApmConfigSchema.parse(options);
  const config = {
    ...parsed,
    database: parsed.database ?? "default",
    table: parsed.table ?? "runner_dev_apm",
    batchSize: parsed.batchSize ?? 1000,
    maxPendingSamples: parsed.maxPendingSamples ?? 10_000,
    flushIntervalMs: parsed.flushIntervalMs ?? 1000,
    timeoutMs: parsed.timeoutMs ?? 10_000,
  };
  if (config.maxPendingSamples < config.batchSize)
    throw new Error("ClickHouse maxPendingSamples must be at least batchSize.");
  const endpoint = new URL(config.url);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error(
      "ClickHouse URL must be an HTTP(S) endpoint without credentials, query or fragment."
    );
  endpoint.searchParams.set("database", config.database);
  const table = `\`${config.database}\`.\`${config.table}\``;
  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
    "X-ClickHouse-User": process.env.CLICKHOUSE_USER ?? "default",
  };
  if (process.env.CLICKHOUSE_PASSWORD)
    headers["X-ClickHouse-Key"] = process.env.CLICKHOUSE_PASSWORD;
  async function request(
    query: string,
    parameters: Record<string, string> = {}
  ) {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(`param_${key}`, value);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: query,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    // Server messages can contain SQL and credentials; expose status, never response bodies.
    if (!response.ok)
      throw new Error(
        `ClickHouse APM request failed (HTTP ${response.status}).`
      );
    return response.text();
  }
  await request(`CREATE TABLE IF NOT EXISTS ${table} (
    streamId String, sequence UInt64, timestampMs Float64,
    completedAt DateTime64(3, 'UTC'), record String,
    expiresAt DateTime64(3, 'UTC') DEFAULT completedAt + INTERVAL 30 DAY
  ) ENGINE = MergeTree ORDER BY (streamId, sequence) TTL expiresAt DELETE`);
  // Upgrade existing APM tables while preserving their archived samples.
  await request(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS expiresAt DateTime64(3, 'UTC') DEFAULT completedAt + INTERVAL 30 DAY`
  );
  await request(`ALTER TABLE ${table} MODIFY TTL expiresAt DELETE`);
  const metadata = `\`${config.database}\`.\`${config.table}_sequences\``;
  await request(
    `CREATE TABLE IF NOT EXISTS ${metadata} (streamId String, sequence UInt64) ENGINE=ReplacingMergeTree(sequence) ORDER BY streamId`
  );
  const retention = clickHouseApmRetention(table, config.streamId, request);
  retention.set({ maxSamples: 10_000 });
  let maxStorage: number | undefined;
  let enqueuedSequence = 0;
  const writer = bufferedApmWriter(async (batch) => {
    await request(
      `INSERT INTO ${table} FORMAT JSONEachRow\n` +
        batch
          .map((sample) =>
            JSON.stringify({
              streamId: config.streamId,
              sequence: sample.sequence,
              timestampMs: sample.timestampMs,
              completedAt: new Date(sample.timestampMs)
                .toISOString()
                .replace("T", " ")
                .replace("Z", ""),
              expiresAt: retention.expiresAt(sample.timestampMs),
              record: JSON.stringify(sample),
            })
          )
          .join("\n")
    );
    await request(
      `INSERT INTO ${metadata} FORMAT JSONEachRow\n` +
        JSON.stringify({
          streamId: config.streamId,
          sequence: batch[batch.length - 1].sequence,
        })
    );
    await retention.trim();
  }, config);
  return {
    storage: "clickhouse",
    async load(options) {
      writer.assertReady();
      await writer.flush();
      const { maxSamples, cutoffTimestampMs, retentionDays } =
        apmRetentionSchema.parse(options);
      maxStorage = options.maxStorage;
      retention.set(options);
      z.number().int().positive().max(10_000_000).parse(maxSamples);
      if (cutoffTimestampMs !== undefined)
        z.number().finite().parse(cutoffTimestampMs);
      const parameters = {
        stream: config.streamId,
        limit: String(maxSamples),
        cutoff: String(
          Math.max(
            cutoffTimestampMs ?? -Infinity,
            retentionDays ? Date.now() - retentionDays * 86_400_000 : -1e300
          )
        ),
      };
      const output = await request(
        `SELECT record FROM ${table} WHERE streamId = {stream:String}
        AND timestampMs >= {cutoff:Float64} ORDER BY sequence DESC LIMIT {limit:UInt32} FORMAT JSONEachRow`,
        parameters
      );
      const samples = output.trim()
        ? output
            .trim()
            .split("\n")
            .map((line) => {
              const row = z
                .object({ record: z.string() })
                .parse(JSON.parse(line));
              const parsed = parsePersistedEntry({
                kind: "run",
                entry: JSON.parse(row.record),
              });
              if (parsed.kind !== "run" || parsed.entry.durationMs < 0)
                throw new Error("Invalid ClickHouse APM sample.");
              return parsed.entry;
            })
            .reverse()
        : [];
      const highest = await request(
        `SELECT max(sequence) AS lastSequence FROM (SELECT sequence FROM ${table} WHERE streamId={stream:String} UNION ALL SELECT sequence FROM ${metadata} WHERE streamId={stream:String}) FORMAT JSONEachRow`,
        { stream: config.streamId }
      );
      const lastSequence = z
        .object({
          lastSequence: z.coerce
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER),
        })
        .parse(JSON.parse(highest)).lastSequence;
      await request(
        `INSERT INTO ${metadata} FORMAT JSONEachRow\n` +
          JSON.stringify({ streamId: config.streamId, sequence: lastSequence })
      );
      await retention.trim();
      if (options.maxStorage) {
        let bytes = 0;
        for (let index = samples.length - 1; index >= 0; index--) {
          bytes += Buffer.byteLength(JSON.stringify(samples[index]));
          if (bytes > options.maxStorage) {
            samples.splice(0, index + 1);
            break;
          }
        }
      }
      let previous = 0;
      for (const sample of samples) {
        if (sample.sequence <= previous || sample.sequence > lastSequence)
          throw new Error(
            "ClickHouse APM sequences must be unique and ascending. Use one stream per runtime."
          );
        previous = sample.sequence;
      }
      enqueuedSequence = lastSequence;
      return { samples, lastSequence };
    },
    append(sample) {
      writer.assertReady();
      const compact = compactApmSample(sample, maxStorage);
      if (compact.sequence <= enqueuedSequence)
        throw new Error(
          "APM sequences must increase; use one stream per runtime."
        );
      writer.append(compact);
      enqueuedSequence = compact.sequence;
      return undefined;
    },
    status: writer.status,
    flush: writer.flush,
    close: writer.close,
  };
}
