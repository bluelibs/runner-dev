import z from "zod";
import type { ApmPersistence } from "./apmPersistence";
import { parsePersistedEntry } from "./persistence.schema";
import type { RunRecord } from "./types";

const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
export const clickHouseApmConfigSchema = z
  .object({
    url: z.string().url(),
    database: identifier.optional(),
    table: identifier.optional(),
    streamId: z.string().min(1),
    retentionDays: z.number().int().positive().max(3650).optional(),
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
  retentionDays?: number;
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
    retentionDays: parsed.retentionDays ?? 30,
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
    completedAt DateTime64(3, 'UTC'), record String
  ) ENGINE = MergeTree ORDER BY (streamId, sequence)
    TTL completedAt + INTERVAL ${config.retentionDays} DAY DELETE`);
  const pending: RunRecord[] = [];
  let inFlightCount = 0;
  let failure: unknown;
  let closed = false;
  let flushing: Promise<void> | undefined;
  function assertReady() {
    if (failure) throw failure;
    if (closed) throw new Error("ClickHouse APM store is closed.");
  }
  async function drain() {
    while (pending.length) {
      const batch = pending.splice(0, config.batchSize);
      inFlightCount = batch.length;
      try {
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
                  record: JSON.stringify(sample),
                })
              )
              .join("\n")
        );
      } finally {
        inFlightCount = 0;
      }
    }
  }
  function flush(): Promise<void> {
    if (failure) return Promise.reject(failure);
    if (flushing) return flushing;
    flushing = drain()
      .catch((cause) => {
        failure =
          cause instanceof Error
            ? cause
            : new Error("ClickHouse APM write failed.");
        throw cause;
      })
      .finally(() => {
        flushing = undefined;
      });
    return flushing;
  }
  // Observe background failures; append/load/flush surface the latched error to callers.
  const timer = setInterval(() => {
    if (pending.length) void flush().catch(() => {});
  }, config.flushIntervalMs);
  timer.unref();
  return {
    storage: "clickhouse",
    async load({ maxSamples, cutoffTimestampMs }) {
      assertReady();
      z.number().int().positive().max(10_000_000).parse(maxSamples);
      if (cutoffTimestampMs !== undefined)
        z.number().finite().parse(cutoffTimestampMs);
      const parameters = {
        stream: config.streamId,
        limit: String(maxSamples),
        cutoff: String(
          Math.max(
            cutoffTimestampMs ?? -Infinity,
            Date.now() - config.retentionDays * 86_400_000
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
        `SELECT max(sequence) AS lastSequence FROM ${table} WHERE streamId = {stream:String} FORMAT JSONEachRow`,
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
      let previous = 0;
      for (const sample of samples) {
        if (sample.sequence <= previous || sample.sequence > lastSequence)
          throw new Error(
            "ClickHouse APM sequences must be unique and ascending. Use one stream per runtime."
          );
        previous = sample.sequence;
      }
      return { samples, lastSequence };
    },
    append(sample) {
      assertReady();
      if (pending.length + inFlightCount >= config.maxPendingSamples)
        throw new Error(
          "ClickHouse APM queue is full; increase capacity or restore database availability."
        );
      const parsed = parsePersistedEntry({ kind: "run", entry: sample });
      if (parsed.kind !== "run" || parsed.entry.durationMs < 0)
        throw new Error("Invalid APM sample.");
      pending.push({
        sequence: parsed.entry.sequence,
        timestampMs: parsed.entry.timestampMs,
        nodeId: parsed.entry.nodeId,
        nodeKind: parsed.entry.nodeKind,
        durationMs: parsed.entry.durationMs,
        ok: parsed.entry.ok,
        parentId: parsed.entry.parentId ? "nested" : null,
      });
      if (pending.length >= config.batchSize) void flush().catch(() => {});
      return undefined;
    },
    status() {
      return {
        pendingSamples: pending.length + inFlightCount,
        error: failure instanceof Error ? failure.message : null,
      };
    },
    flush,
    async close() {
      clearInterval(timer);
      closed = true;
      await flush();
    },
  };
}
