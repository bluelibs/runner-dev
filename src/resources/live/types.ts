/**
 * Every level Runner's logger emits (trace..critical), plus `fatal` and `log`
 * for entries recorded directly through `Live.recordLog`. Runner's own level
 * type must stay assignable to this one, so a new Runner level fails the
 * build instead of an enum serialization at query time.
 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "critical"
  | "fatal"
  | "log";

export type ErrorSourceKind =
  | "TASK"
  | "HOOK"
  | "RESOURCE"
  | "MIDDLEWARE"
  | "INTERNAL";

export type RunNodeKind = "TASK" | "HOOK";

export type LiveRecordKind = "log" | "emission" | "error" | "run";

/** Position and time stamps every live store entry carries. */
export interface LiveEntryStamp {
  /**
   * Strictly increasing position of the entry in its live store, shared by
   * logs, emissions, errors and runs and never reused. It is the lossless
   * cursor: unlike `timestampMs`, two entries never share a value.
   */
  sequence: number;
  timestampMs: number;
}

export interface LogEntry extends LiveEntryStamp {
  level: LogLevel;
  message: string;
  sourceId?: string | null;
  data?: unknown;
  correlationId?: string | null;
}

export interface EmissionEntry extends LiveEntryStamp {
  eventId: string;
  emitterId?: string | null;
  payload?: unknown;
  correlationId?: string | null;
}

export interface ErrorEntry extends LiveEntryStamp {
  sourceId: string;
  sourceKind: ErrorSourceKind;
  message: string;
  stack?: string | null;
  data?: unknown;
  correlationId?: string | null;
}

export interface RunRecord extends LiveEntryStamp {
  nodeId: string;
  nodeKind: RunNodeKind;
  durationMs: number;
  ok: boolean;
  error?: string | null;
  parentId?: string | null;
  rootId?: string | null;
  correlationId?: string | null;
}

/**
 * Cursor and window options shared by every live query.
 *
 * With a cursor (`afterSequence` and/or `afterTimestamp`), `last` returns the
 * OLDEST N matching entries after the cursor so callers can page forward
 * without gaps. Without a cursor, `last` returns the most recent N.
 */
export interface LiveCursorOptions {
  /** Exclusive wall-clock cursor (ms since epoch). */
  afterTimestamp?: number;
  /** Exclusive sequence cursor; lossless even when entries share a millisecond. */
  afterSequence?: number;
  /** Maximum number of entries to return. */
  last?: number;
}

export interface LogQueryOptions extends LiveCursorOptions {
  levels?: LogLevel[];
  messageIncludes?: string;
  correlationIds?: string[];
}

export interface EmissionQueryOptions extends LiveCursorOptions {
  eventIds?: string[];
  emitterIds?: string[];
  correlationIds?: string[];
}

export interface ErrorQueryOptions extends LiveCursorOptions {
  sourceKinds?: ErrorSourceKind[];
  sourceIds?: string[];
  messageIncludes?: string;
  correlationIds?: string[];
}

export interface RunQueryOptions extends LiveCursorOptions {
  nodeKinds?: RunNodeKind[];
  nodeIds?: string[];
  ok?: boolean;
  parentIds?: string[];
  rootIds?: string[];
  correlationIds?: string[];
}

/**
 * Live telemetry store. Query methods also accept a bare number, which is
 * shorthand for `{ afterTimestamp: number }`.
 */
export interface Live {
  getLogs(options?: number | LogQueryOptions): LogEntry[];
  getEmissions(options?: number | EmissionQueryOptions): EmissionEntry[];
  getErrors(options?: number | ErrorQueryOptions): ErrorEntry[];
  getRuns(options?: number | RunQueryOptions): RunRecord[];
  recordLog(
    level: LogLevel,
    message: string,
    data?: unknown,
    correlationId?: string | null,
    sourceId?: string | null
  ): void;
  recordEmission(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): void;
  recordError(
    sourceId: string,
    sourceKind: ErrorSourceKind,
    error: unknown,
    data?: unknown
  ): void;
  recordRun(
    nodeId: string,
    nodeKind: RunNodeKind,
    durationMs: number,
    ok: boolean,
    error?: unknown,
    parentId?: string | null,
    rootId?: string | null
  ): void;
  /** Register a listener that fires whenever a record* method is called. Returns an unsubscribe function. */
  onRecord(callback: (kind: LiveRecordKind) => void): () => void;
}
