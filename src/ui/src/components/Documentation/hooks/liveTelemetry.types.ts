// Shapes of the live telemetry the docs UI receives over SSE or GraphQL.

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

export interface CpuStats {
  usage: number;
  loadAverage: number;
}

export interface EventLoopStats {
  lag: number;
}

export interface GcStats {
  collections: number;
  duration: number;
}

/** Store-wide position of an entry; the lossless cursor for paging. */
export interface SequencedEntry {
  sequence: number;
}

export interface LogEntry extends SequencedEntry {
  timestampMs: number;
  level: string;
  message: string;
  data?: string;
  correlationId?: string;
  sourceId?: string;
}

export interface EmissionEntry extends SequencedEntry {
  timestampMs: number;
  eventId: string;
  emitterId?: string;
  payload?: string;
  correlationId?: string;
  eventResolved?: {
    id: string;
    meta?: {
      title?: string;
      description?: string;
    };
    tags: Array<{
      id: string;
      config?: string;
    }>;
  };
}

export interface ErrorEntry extends SequencedEntry {
  timestampMs: number;
  sourceId: string;
  sourceKind: string;
  message: string;
  stack?: string;
  data?: string;
  correlationId?: string;
  sourceResolved?: {
    id: string;
    meta?: {
      title?: string;
      description?: string;
    };
    tags: Array<{
      id: string;
      config?: string;
    }>;
  };
}

export interface RunRecord extends SequencedEntry {
  timestampMs: number;
  nodeId: string;
  nodeKind: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
  correlationId?: string;
}

export interface LiveData {
  memory: MemoryStats;
  cpu: CpuStats;
  eventLoop: EventLoopStats;
  gc: GcStats;
  logs: LogEntry[];
  emissions: EmissionEntry[];
  errors: ErrorEntry[];
  runs: RunRecord[];
}

export type TelemetryCategory = "logs" | "emissions" | "errors" | "runs";

export type HealthSnapshot = Pick<
  LiveData,
  "memory" | "cpu" | "eventLoop" | "gc"
>;

/**
 * New entries per category. A category left undefined was not fetched in
 * that round, which is different from fetched-and-empty (`[]`).
 */
export type TelemetryDelta = Partial<Pick<LiveData, TelemetryCategory>>;

/**
 * Last received `sequence` per category. `null` means no position is known
 * yet, so the next fetch asks for the most recent entries instead of paging.
 */
export type TelemetryCursors = Record<TelemetryCategory, number | null>;
