import type { DatabaseSync } from "node:sqlite";
import { compactApmSample } from "./apmSample";
import { parsePersistedEntry } from "./persistence.schema";
/** APM previously reused the live schema; move its runs once without resetting sequences. */
export function migrateApmSqlite(db: DatabaseSync) {
  const legacy = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='runner_dev_live_entries'"
    )
    .get();
  if (!legacy) return;
  const current = db
    .prepare("SELECT last_sequence FROM runner_dev_apm_meta WHERE id=1")
    .get();
  if (current?.last_sequence !== 0) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const insert = db.prepare(
      "INSERT INTO runner_dev_apm_samples VALUES(?,?,?,?)"
    );
    for (const row of db
      .prepare(
        "SELECT record FROM runner_dev_live_entries WHERE kind='run' ORDER BY sequence"
      )
      .all()) {
      if (typeof row.record !== "string")
        throw new Error("Invalid legacy APM record.");
      const parsed = parsePersistedEntry(JSON.parse(row.record));
      if (parsed.kind !== "run") throw new Error("Invalid legacy APM sample.");
      const sample = compactApmSample(parsed.entry),
        record = JSON.stringify(sample);
      insert.run(
        sample.sequence,
        sample.timestampMs,
        Buffer.byteLength(record),
        record
      );
    }
    const meta = db
      .prepare(
        "SELECT version,last_sequence FROM runner_dev_live_meta WHERE id=1"
      )
      .get();
    if (meta?.version !== 1 || typeof meta.last_sequence !== "number")
      throw new Error("Invalid legacy APM metadata.");
    db.prepare("UPDATE runner_dev_apm_meta SET last_sequence=? WHERE id=1").run(
      meta.last_sequence
    );
    db.exec("DELETE FROM runner_dev_live_entries WHERE kind='run'; COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
