import type { LivePersistence, LivePersistenceSnapshot } from "./persistence";
import {
  parsePersistedEntry,
  validatePersistenceSnapshot,
} from "./persistence.schema";
import { telemetryJson } from "./telemetryJson";
import { sqliteWorkerClient } from "./sqliteWorkerClient";
import { bufferedPersistenceWriter } from "./bufferedPersistenceWriter";
import type { LiveSqliteWrite } from "./sqliteWorker.protocol";

export interface SQLitePersistenceOptions {
  /** SQLite file path. Parent directories are created in the worker. */
  file: string;
}
export interface SQLitePersistence extends LivePersistence {
  load(options: { maxEntries: number }): Promise<LivePersistenceSnapshot>;
  flush(): Promise<void>;
  close(): Promise<void>;
  status(): { pendingEntries: number; error: string | null };
}
function validateMaxEntries(maxEntries: number) {
  if (!Number.isInteger(maxEntries) || maxEntries < 0)
    throw new Error("SQLite maxEntries must be a non-negative integer.");
}
/** Records are accepted into a bounded queue; flush/close acknowledge disk commits. */
export function sqlitePersistence(
  options: SQLitePersistenceOptions
): SQLitePersistence {
  if (typeof options.file !== "string" || !options.file.trim())
    throw new Error("SQLite persistence requires a non-empty file path.");
  const client = sqliteWorkerClient("live", options.file);
  const writer = bufferedPersistenceWriter<LiveSqliteWrite>(async (items) => {
    await client.request({ operation: "live-write", items });
  });
  let lastSequence = 0;
  let restoring = false;
  return {
    load({ maxEntries }) {
      validateMaxEntries(maxEntries);
      writer.assertReady();
      client.assertReady();
      if (restoring)
        throw new Error("SQLite restoration is already in progress.");
      restoring = true;
      return (async () => {
        try {
          await writer.flush();
          const response = await client.request({
            operation: "live-load",
            maxEntries,
          });
          if (response.operation !== "live-load")
            throw new Error("Unexpected SQLite load response.");
          validatePersistenceSnapshot(response.snapshot);
          lastSequence = response.snapshot.lastSequence;
          return response.snapshot;
        } finally {
          restoring = false;
        }
      })();
    },
    append(record, { maxEntries }) {
      validateMaxEntries(maxEntries);
      client.assertReady();
      if (restoring)
        throw new Error("Wait for SQLite restoration before recording.");
      const snapshot = parsePersistedEntry(JSON.parse(telemetryJson(record)));
      if (snapshot.entry.sequence <= lastSequence)
        throw new Error(
          "Live persistence sequences must increase. Use one SQLite file per runtime."
        );
      writer.append({ record: snapshot, maxEntries });
      lastSequence = snapshot.entry.sequence;
      return undefined;
    },
    flush() {
      if (client.error())
        return Promise.reject(
          new Error(client.error() ?? "SQLite worker failed.")
        );
      return writer.flush();
    },
    status() {
      const state = writer.status();
      return {
        pendingEntries: state.pendingSamples,
        error: state.error ?? client.error(),
      };
    },
    async close() {
      try {
        await writer.close();
      } finally {
        await client.close();
      }
    },
  };
}
