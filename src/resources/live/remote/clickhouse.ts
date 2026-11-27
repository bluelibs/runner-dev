import z from "zod";
import { remoteHistory } from "./store";

export const clickHouseHistoryConfig = z
  .object({
    url: z.string().url(),
    streamId: z.string().min(1),
    database: z
      .string()
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .optional(),
  })
  .strict();

export async function clickHouseHistory(
  config: z.infer<typeof clickHouseHistoryConfig>
) {
  const endpoint = new URL(config.url);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error(
      "Use an HTTP(S) ClickHouse endpoint without credentials, query or fragment."
    );
  endpoint.searchParams.set("database", config.database ?? "default");
  endpoint.searchParams.set("wait_end_of_query", "1");
  const headers = {
    "X-ClickHouse-User": process.env.CLICKHOUSE_USER ?? "default",
    "X-ClickHouse-Key": process.env.CLICKHOUSE_PASSWORD ?? "",
  };
  async function request(query: string, params: Record<string, string> = {}) {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    const response = await fetch(url, {
      method: "POST",
      body: query,
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        `ClickHouse history request failed (HTTP ${response.status}).`
      );
    return response.text();
  }
  await request(`CREATE TABLE IF NOT EXISTS runner_dev_live_history (
    stream String, slot String, revision UInt64, record String
  ) ENGINE=ReplacingMergeTree(revision) ORDER BY (stream,slot)`);
  return remoteHistory({
    async read() {
      const result = await request(
        `SELECT slot,record FROM runner_dev_live_history FINAL
        WHERE stream={stream:String} AND record != '' FORMAT JSONEachRow`,
        { param_stream: config.streamId }
      );
      return result.trim()
        ? result
            .trim()
            .split("\n")
            .map((line) =>
              z
                .object({ slot: z.string(), record: z.string() })
                .parse(JSON.parse(line))
            )
        : [];
    },
    async commit(changes, revision) {
      const current = await request(
        "SELECT max(revision) FROM runner_dev_live_history WHERE stream={stream:String} AND slot='meta' FORMAT TabSeparated",
        { param_stream: config.streamId }
      );
      if (current.trim() !== String(revision - 1))
        throw new Error("Live history stream has another writer.");
      // A synchronous insert into one partition and one block publishes the slots and watermark together.
      await request(
        "INSERT INTO runner_dev_live_history FORMAT JSONEachRow\n" +
          changes
            .map((row) =>
              JSON.stringify({ ...row, stream: config.streamId, revision })
            )
            .join("\n"),
        {
          async_insert: "0",
          input_format_parallel_parsing: "0",
          max_insert_block_size: String(changes.length + 1),
          min_insert_block_size_rows: String(changes.length + 1),
          min_insert_block_size_bytes: "0",
        }
      );
    },
    async close() {},
  });
}
