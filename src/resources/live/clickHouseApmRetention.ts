import type { ApmRetention } from "./apmPersistence";
/** Apply one stream's policy without changing retention for other workers in the table. */
export function clickHouseApmRetention(
  table: string,
  stream: string,
  request: (
    query: string,
    parameters?: Record<string, string>
  ) => Promise<string>
) {
  let policy: ApmRetention = { maxSamples: 10_000 };
  return {
    set(options: ApmRetention) {
      policy = options;
    },
    expiresAt(timestampMs: number) {
      return new Date(
        policy.retentionDays
          ? timestampMs + policy.retentionDays * 86_400_000
          : Date.UTC(2299, 0, 1)
      )
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");
    },
    async trim() {
      const cutoff = Math.max(
        policy.cutoffTimestampMs ?? -1e300,
        policy.retentionDays
          ? Date.now() - policy.retentionDays * 86_400_000
          : -1e300
      );
      const parameters = {
        stream,
        cutoff: String(cutoff),
        limit: String(policy.maxSamples),
        bytes: String(policy.maxStorage ?? Number.MAX_SAFE_INTEGER),
      };
      const output = await request(
        `SELECT minOrNull(sequence) AS oldest FROM (
        SELECT sequence, sum(length(record)) OVER (ORDER BY sequence DESC) AS bytes
        FROM (SELECT sequence, record FROM ${table} WHERE streamId={stream:String}
          AND timestampMs>={cutoff:Float64} ORDER BY sequence DESC LIMIT {limit:UInt32})
      ) WHERE bytes<={bytes:UInt64} FORMAT JSONEachRow`,
        parameters
      );
      const row: unknown = JSON.parse(output);
      if (!row || typeof row !== "object" || !("oldest" in row))
        throw new Error("Invalid ClickHouse retention boundary.");
      const oldest = row.oldest;
      if (oldest !== null && !/^\d+$/.test(String(oldest)))
        throw new Error("Invalid ClickHouse retention sequence.");
      await request(
        `ALTER TABLE ${table} DELETE WHERE streamId={stream:String} AND
        (timestampMs<{cutoff:Float64} OR ${
          oldest === null ? "1" : "sequence<{oldest:UInt64}"
        }) SETTINGS mutations_sync=1`,
        { ...parameters, oldest: String(oldest ?? 0) }
      );
    },
  };
}
