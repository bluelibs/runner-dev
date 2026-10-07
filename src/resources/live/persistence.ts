import type { IResource, IResourceWithConfig } from "@bluelibs/runner";
import type { EmissionEntry, ErrorEntry, LogEntry, RunRecord } from "./types";

export type LivePersistedEntry =
  | { kind: "log"; entry: LogEntry }
  | { kind: "emission"; entry: EmissionEntry }
  | { kind: "error"; entry: ErrorEntry }
  | { kind: "run"; entry: RunRecord };

export interface LivePersistenceSnapshot {
  /** Retained entries in ascending, store-wide sequence order. */
  entries: LivePersistedEntry[];
  /** Highest committed sequence, including entries already evicted. */
  lastSequence: number;
}

export interface LivePersistenceOptions {
  maxEntries: number;
}

export interface LivePersistence {
  /** Trim each category to the cap before returning retained history. */
  load(
    options: LivePersistenceOptions
  ): LivePersistenceSnapshot | Promise<LivePersistenceSnapshot>;
  /**
   * Accept the entry synchronously, either committing it or enqueueing it in a bounded buffer.
   * Buffered providers must drain accepted entries during disposal.
   * `undefined` (rather than `void`) prevents accidentally accepting async writes.
   */
  append(
    record: LivePersistedEntry,
    options: LivePersistenceOptions
  ): undefined;
}

// Resource lifecycle callbacks may use a more specific store value (for example
// SQLite's close()). Check the initialized contract without erasing its methods.
export type LivePersistenceResourceDefinition = Omit<
  IResource<any, any, any, any, any, any, any>,
  "init"
> & {
  init?: IResource<
    any,
    Promise<LivePersistence>,
    any,
    any,
    any,
    any,
    any
  >["init"];
};

export type LivePersistenceResource =
  | LivePersistenceResourceDefinition
  | (Omit<
      IResourceWithConfig<any, any, any, any, any, any, any>,
      "resource"
    > & {
      resource: LivePersistenceResourceDefinition;
    });

export type LivePersistenceSource = LivePersistenceResource;

export interface LiveConfig {
  apm?: import("./apm").ApmConfig;
  maxEntries?: number;
  persistence?: LivePersistenceSource;
}
