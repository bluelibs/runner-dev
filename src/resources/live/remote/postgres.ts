import z from "zod";
import { remoteHistory, type StoredSlot } from "./store";

export const postgresHistoryConfig = z
  .object({ streamId: z.string().min(1) })
  .strict();
/** pg resolves PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD outside exported resource config. */
export async function postgresHistory({
  streamId,
}: z.infer<typeof postgresHistoryConfig>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg: typeof import("pg") = require("pg");
  const pool = new pg.Pool({
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  // Idle clients are discarded by the pool; subsequent operations get a fresh connection.
  pool.on("error", () => {});
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS runner_dev_live_history (
      stream_id text NOT NULL, slot text NOT NULL, record text NOT NULL,
      PRIMARY KEY (stream_id, slot))`);
  } catch (error) {
    await pool.end();
    throw error;
  }
  return remoteHistory({
    async read() {
      return (
        await pool.query<StoredSlot>(
          "SELECT slot, record FROM runner_dev_live_history WHERE stream_id=$1",
          [streamId]
        )
      ).rows;
    },
    async commit(changes, revision) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [streamId]
        );
        const meta = await client.query<{ revision: number }>(
          "SELECT (record::jsonb->>'revision')::float8 AS revision FROM runner_dev_live_history WHERE stream_id=$1 AND slot='meta'",
          [streamId]
        );
        if ((meta.rows[0]?.revision ?? 0) !== revision - 1)
          throw new Error("Live history stream has another writer.");
        await client.query(
          `INSERT INTO runner_dev_live_history (stream_id,slot,record)
          SELECT $1,slot,record FROM jsonb_to_recordset($2::jsonb) AS rows(slot text,record text) WHERE record <> ''
          ON CONFLICT (stream_id,slot) DO UPDATE SET record=excluded.record`,
          [streamId, JSON.stringify(changes)]
        );
        const removed = changes
          .filter((row) => !row.record)
          .map((row) => row.slot);
        if (removed.length)
          await client.query(
            "DELETE FROM runner_dev_live_history WHERE stream_id=$1 AND slot=ANY($2::text[])",
            [streamId, removed]
          );
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          discard = true;
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    close: () => pool.end(),
  });
}
