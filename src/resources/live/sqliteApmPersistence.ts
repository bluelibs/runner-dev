import { migrateApmSqlite } from "./migrateApmSqlite";
import { apmRetentionSchema } from "./apmRetention";
import { compactApmSample } from "./apmSample";
import type { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { bufferedApmWriter } from "./bufferedApmWriter";
import type { ApmRetention } from "./apmPersistence";
import type { RunRecord } from "./types";
import { parsePersistedEntry } from "./persistence.schema";

/** APM accepts buffered writes; live log persistence keeps its synchronous contract. */
export function sqliteApmPersistence(file: string) {
  let SQLite: typeof import("node:sqlite");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SQLite = require("node:sqlite");
  } catch (cause) {
    throw new Error("SQLite APM requires the Node SQLite builtin.", { cause });
  }
  const path = file === ":memory:" ? file : resolve(file);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db: DatabaseSync = new SQLite.DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS runner_dev_apm_samples(sequence INTEGER PRIMARY KEY,timestamp_ms REAL NOT NULL,bytes INTEGER NOT NULL,record TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS runner_dev_apm_time ON runner_dev_apm_samples(timestamp_ms);
   CREATE TABLE IF NOT EXISTS runner_dev_apm_meta(id INTEGER PRIMARY KEY,last_sequence INTEGER NOT NULL);
   INSERT OR IGNORE INTO runner_dev_apm_meta VALUES(1,0);`);
    migrateApmSqlite(db);
    let policy: ApmRetention = { maxSamples: 10_000 };
    const insert = db.prepare(
      "INSERT INTO runner_dev_apm_samples VALUES(?,?,?,?)"
    );
    const update = db.prepare(
      "UPDATE runner_dev_apm_meta SET last_sequence=? WHERE id=1 AND last_sequence<?"
    );
    const expired = db.prepare(
      "DELETE FROM runner_dev_apm_samples WHERE timestamp_ms<?"
    );
    const trimCount = db.prepare(
      "DELETE FROM runner_dev_apm_samples WHERE sequence <= (SELECT sequence FROM runner_dev_apm_samples ORDER BY sequence DESC LIMIT 1 OFFSET ?)"
    );
    const trimBytes =
      db.prepare(`DELETE FROM runner_dev_apm_samples WHERE sequence < COALESCE((
    SELECT MIN(sequence) FROM (SELECT sequence,SUM(bytes) OVER(ORDER BY sequence DESC) AS total FROM runner_dev_apm_samples) WHERE total<=?
   ),9223372036854775807)`);
    function cutoff() {
      return Math.max(
        policy.cutoffTimestampMs ?? -Infinity,
        policy.retentionDays
          ? Date.now() - policy.retentionDays * 86_400_000
          : -Infinity
      );
    }
    function trim() {
      const date = cutoff();
      if (Number.isFinite(date)) expired.run(date);
      trimCount.run(policy.maxSamples);
      if (policy.maxStorage) trimBytes.run(policy.maxStorage);
    }
    function transaction(action: () => void) {
      db.exec("BEGIN IMMEDIATE");
      try {
        action();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    const writer = bufferedApmWriter((samples) =>
      transaction(() => {
        for (const sample of samples) {
          const record = JSON.stringify(sample);
          if (update.run(sample.sequence, sample.sequence).changes !== 1)
            throw new Error(
              "APM sequences must increase; use one SQLite file per runtime."
            );
          insert.run(
            sample.sequence,
            sample.timestampMs,
            Buffer.byteLength(record),
            record
          );
        }
        trim();
      })
    );
    return {
      storage: "sqlite",
      append(sample: RunRecord) {
        return writer.append(compactApmSample(sample, policy.maxStorage));
      },
      flush: writer.flush,
      status: writer.status,
      load(options: ApmRetention) {
        writer.assertReady();
        if (writer.status().pendingSamples)
          throw new Error("Flush APM samples before restoring SQLite.");
        policy = apmRetentionSchema.parse(options);
        transaction(trim);
        const samples = db
          .prepare(
            "SELECT record FROM runner_dev_apm_samples ORDER BY sequence"
          )
          .all()
          .map((row) => {
            if (typeof row.record !== "string")
              throw new Error("Invalid APM SQLite record.");
            const parsed = parsePersistedEntry({
              kind: "run",
              entry: JSON.parse(row.record),
            });
            if (parsed.kind !== "run")
              throw new Error("Invalid APM SQLite sample.");
            return parsed.entry;
          });
        const meta = db
          .prepare("SELECT last_sequence FROM runner_dev_apm_meta WHERE id=1")
          .get();
        if (typeof meta?.last_sequence !== "number")
          throw new Error("Invalid APM SQLite sequence.");
        return { samples, lastSequence: meta.last_sequence };
      },
      async close() {
        try {
          await writer.close();
        } finally {
          db.close();
        }
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
