import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type * as SQLite from "node:sqlite";
import type { DatabaseSync } from "node:sqlite";
import type { LivePersistedEntry } from "./persistence";
import { parsePersistedEntry } from "./persistence.schema";
import { telemetryJson } from "./telemetryJson";

const KINDS = ["log", "emission", "error", "run"] as const;

function loadSQLite(): typeof SQLite {
  try {
    // SQLite is optional; memory-only runtimes must not load it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite: typeof SQLite = require("node:sqlite");
    return sqlite;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ERR_UNKNOWN_BUILTIN_MODULE"
    ) {
      throw new Error(
        "SQLite telemetry persistence requires Node.js 22.13+ (or --experimental-sqlite on Node 22.5–22.12).",
        { cause: error }
      );
    }
    throw error;
  }
}

function transaction<T>(database: DatabaseSync, action: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function createStore(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS runner_dev_live_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      last_sequence INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO runner_dev_live_meta VALUES (1, 1, 0);
    CREATE TABLE IF NOT EXISTS runner_dev_live_entries (
      sequence INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('log', 'emission', 'error', 'run')),
      record TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runner_dev_live_kind_sequence
      ON runner_dev_live_entries (kind, sequence);
    CREATE INDEX IF NOT EXISTS runner_dev_live_timestamp
      ON runner_dev_live_entries (kind, json_extract(record, '$.entry.timestampMs'));
  `);
  const meta = database
    .prepare(
      "SELECT version, last_sequence FROM runner_dev_live_meta WHERE id = 1"
    )
    .get();
  if (meta?.version !== 1)
    throw new Error("Unsupported runner-dev SQLite persistence version.");

  const trim = database.prepare(`
    DELETE FROM runner_dev_live_entries WHERE kind = ? AND sequence <= (
      SELECT sequence FROM runner_dev_live_entries WHERE kind = ?
      ORDER BY sequence DESC LIMIT 1 OFFSET ?
    )
  `);
  const insert = database.prepare(
    "INSERT INTO runner_dev_live_entries VALUES (?, ?, ?)"
  );
  const updateSequence = database.prepare(
    "UPDATE runner_dev_live_meta SET last_sequence = ? WHERE id = 1 AND last_sequence < ?"
  );
  return {
    load({ maxEntries }: { maxEntries: number }) {
      validateMaxEntries(maxEntries);
      transaction(database, () => {
        for (const kind of KINDS) trim.run(kind, kind, maxEntries);
      });
      const current = database
        .prepare("SELECT last_sequence FROM runner_dev_live_meta WHERE id = 1")
        .get();
      if (typeof current?.last_sequence !== "number")
        throw new Error("Invalid runner-dev SQLite sequence metadata.");
      const entries = database
        .prepare("SELECT record FROM runner_dev_live_entries ORDER BY sequence")
        .all()
        .map((row) => {
          if (typeof row.record !== "string")
            throw new Error("Invalid runner-dev SQLite entry.");
          return parsePersistedEntry(JSON.parse(row.record));
        });
      return { entries, lastSequence: current.last_sequence };
    },
    writeBatch(
      items: Array<{ record: LivePersistedEntry; maxEntries: number }>
    ) {
      transaction(database, () => {
        let cap: number | undefined;
        const changedKinds = new Set<LivePersistedEntry["kind"]>();
        const trimChanged = (maxEntries: number) => {
          for (const kind of changedKinds) trim.run(kind, kind, maxEntries);
          changedKinds.clear();
        };
        for (const { record, maxEntries } of items) {
          validateMaxEntries(maxEntries);
          if (cap !== undefined && cap !== maxEntries) trimChanged(cap);
          cap = maxEntries;
          const sequence = record.entry.sequence;
          if (updateSequence.run(sequence, sequence).changes !== 1)
            throw new Error(
              "Live persistence sequences must increase. Use one SQLite file per runtime."
            );
          insert.run(sequence, record.kind, telemetryJson(record));
          changedKinds.add(record.kind);
        }
        if (cap !== undefined) trimChanged(cap);
      });
    },
    close() {
      database.close();
    },
  };
}

function validateMaxEntries(maxEntries: number): void {
  if (!Number.isInteger(maxEntries) || maxEntries < 0)
    throw new Error("SQLite maxEntries must be a non-negative integer.");
}

/** Initialize this store in a Runner resource; release it in that resource's dispose. */
export function openSqliteLiveStore(options: { file: string }) {
  if (typeof options.file !== "string" || options.file.trim().length === 0) {
    throw new Error("SQLite persistence requires a non-empty file path.");
  }
  const file =
    options.file === ":memory:" ? options.file : resolve(options.file);
  const { DatabaseSync } = loadSQLite();
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  try {
    return createStore(database);
  } catch (error) {
    database.close();
    throw error;
  }
}
