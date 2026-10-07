import type { ApmRetention } from "./apmPersistence";
import type {
  LivePersistedEntry,
  LivePersistenceSnapshot,
} from "./persistence";
import type { RunRecord } from "./types";

export interface LiveSqliteWrite {
  record: LivePersistedEntry;
  maxEntries: number;
}
export type SqliteCommand =
  | { operation: "live-load"; maxEntries: number }
  | { operation: "live-write"; items: LiveSqliteWrite[] }
  | { operation: "apm-load"; options: ApmRetention }
  | { operation: "apm-write"; samples: RunRecord[] }
  | { operation: "close" };
export type SqliteRequest = SqliteCommand & { id: number };
export type SqliteResult =
  | { operation: "live-load"; snapshot: LivePersistenceSnapshot }
  | {
      operation: "apm-load";
      snapshot: { samples: RunRecord[]; lastSequence: number };
    }
  | { operation: "written" | "closed" };
export type SqliteResponse =
  | ({ id: number } & SqliteResult)
  | { id: number; error: string };
