import { useState, useEffect, useRef, useCallback } from "react";
import { graphqlRequest } from "../utils/graphqlClient";

// ---------------------------------------------------------------------------
// Re-export-friendly base URL helper (mirrors graphqlClient.ts)
// ---------------------------------------------------------------------------

declare const __API_URL__: string;

function getBaseUrl(): string {
  try {
    const base: string = __API_URL__;
    if (base && typeof base === "string" && base.length > 0) return base;
  } catch {
    // Ignore unresolved __API_URL__
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Return the max `timestampMs` across one or more entry arrays, or undefined if all empty. */
function latestTimestamp(
  ...arrays: Array<{ timestampMs: number }[]>
): number | undefined {
  let max: number | undefined;
  for (const arr of arrays) {
    for (const entry of arr) {
      if (max === undefined || entry.timestampMs > max) max = entry.timestampMs;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// Types (shared with LivePanel)
// ---------------------------------------------------------------------------

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

export interface LogEntry {
  timestampMs: number;
  level: string;
  message: string;
  data?: string;
  correlationId?: string;
  sourceId?: string;
}

export interface EmissionEntry {
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

export interface ErrorEntry {
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

export interface RunRecord {
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

export type ConnectionMode = "sse" | "polling";

/** Default polling interval (ms) when SSE is unavailable or paused. */
export const DEFAULT_POLL_INTERVAL_MS = 2_000;
export const MIN_POLL_INTERVAL_MS = 500;
export const MAX_POLL_INTERVAL_MS = 10_000;

/** Maximum items kept per telemetry category in the client-side buffer. */
const MAX_BUFFER_ENTRIES = 100;

export interface UseLiveStreamOptions {
  /** Whether to start in detailed mode (fetches more entries per request). */
  detailed?: boolean;
  /** Initial poll interval in ms (used only in polling mode). */
  initialPollInterval?: number;
}

export interface UseLiveStreamResult {
  liveData: LiveData | null;
  error: string | null;
  /** Current connection transport: SSE or polling fallback. */
  connectionMode: ConnectionMode;
  /** Whether live updates are actively streaming/polling. */
  isActive: boolean;
  /** Toggle live updates on/off. */
  setIsActive: (active: boolean) => void;
  /** Current poll interval in ms (only relevant in polling mode). */
  pollInterval: number;
  /** Update poll interval (clamped to 500ms–10s). */
  setPollInterval: (ms: number) => void;
  /** Trigger an immediate manual refresh (works in both modes). */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// GraphQL query (used as polling fallback)
// ---------------------------------------------------------------------------

const LIVE_DATA_QUERY = `
  query LiveData($afterTimestamp: Float, $last: Int) {
    live {
      memory { heapUsed heapTotal rss }
      cpu { usage loadAverage }
      eventLoop { lag }
      gc(windowMs: 30000) { collections duration }
      logs(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs level message data correlationId sourceId
      }
      emissions(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs eventId emitterId payload correlationId
        eventResolved { id tags { id config } meta { title description } }
      }
      errors(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs sourceId sourceKind message stack data correlationId
        sourceResolved { id tags { id config } meta { title description } }
      }
      runs(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs nodeId nodeKind ok durationMs error correlationId
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeLiveData(
  prev: LiveData | null,
  incoming: Partial<LiveData>,
  isIncremental: boolean
): LiveData {
  if (!prev || !isIncremental) {
    return {
      memory: incoming.memory ?? { heapUsed: 0, heapTotal: 0, rss: 0 },
      cpu: incoming.cpu ?? { usage: 0, loadAverage: 0 },
      eventLoop: incoming.eventLoop ?? { lag: 0 },
      gc: incoming.gc ?? { collections: 0, duration: 0 },
      logs: (incoming.logs ?? []).slice(-MAX_BUFFER_ENTRIES),
      emissions: (incoming.emissions ?? []).slice(-MAX_BUFFER_ENTRIES),
      errors: (incoming.errors ?? []).slice(-MAX_BUFFER_ENTRIES),
      runs: (incoming.runs ?? []).slice(-MAX_BUFFER_ENTRIES),
    };
  }

  return {
    memory: incoming.memory ?? prev.memory,
    cpu: incoming.cpu ?? prev.cpu,
    eventLoop: incoming.eventLoop ?? prev.eventLoop,
    gc: incoming.gc ?? prev.gc,
    logs: [...prev.logs, ...(incoming.logs ?? [])].slice(-MAX_BUFFER_ENTRIES),
    emissions: [...prev.emissions, ...(incoming.emissions ?? [])].slice(
      -MAX_BUFFER_ENTRIES
    ),
    errors: [...prev.errors, ...(incoming.errors ?? [])].slice(
      -MAX_BUFFER_ENTRIES
    ),
    runs: [...prev.runs, ...(incoming.runs ?? [])].slice(-MAX_BUFFER_ENTRIES),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveStream(
  options: UseLiveStreamOptions = {}
): UseLiveStreamResult {
  const { detailed = false, initialPollInterval = DEFAULT_POLL_INTERVAL_MS } =
    options;

  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("sse");
  const [isActive, setIsActive] = useState(true);
  const [pollInterval, setPollIntervalRaw] = useState(initialPollInterval);

  // Refs to avoid stale closures
  const cursorRef = useRef<number>(Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const setPollInterval = useCallback((ms: number) => {
    setPollIntervalRaw(
      Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, ms))
    );
  }, []);

  // -----------------------------------------------------------------------
  // Polling fallback
  // -----------------------------------------------------------------------

  const fetchLiveData = useCallback(
    async (afterTimestamp?: number) => {
      try {
        const variables: Record<string, unknown> = {
          last: detailed ? 50 : 10,
        };
        if (afterTimestamp) {
          variables.afterTimestamp = afterTimestamp;
        }

        const data = await graphqlRequest<{ live: LiveData }>(
          LIVE_DATA_QUERY,
          variables
        );

        if (data.live) {
          setLiveData((prev) =>
            mergeLiveData(prev, data.live, !!afterTimestamp)
          );

          // Advance cursor
          const latest = latestTimestamp(
            data.live.logs,
            data.live.emissions,
            data.live.errors,
            data.live.runs
          );
          if (latest !== undefined) cursorRef.current = latest;
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch live data"
        );
      }
    },
    [detailed]
  );

  // -----------------------------------------------------------------------
  // Polling start/stop
  // -----------------------------------------------------------------------

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Initial fetch
    fetchLiveData();

    pollTimerRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      fetchLiveData(cursorRef.current);
    }, pollInterval);
  }, [fetchLiveData, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // SSE connection
  // -----------------------------------------------------------------------

  const connectSSE = useCallback(() => {
    // Clean up any previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = new URL("/live/stream", getBaseUrl()).toString();
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("telemetry", (event: MessageEvent) => {
      if (!isActiveRef.current) return;
      try {
        const delta = JSON.parse(event.data) as Pick<
          LiveData,
          "logs" | "emissions" | "errors" | "runs"
        >;

        setLiveData((prev) => mergeLiveData(prev, delta, true));

        // Advance cursor from the latest timestamps in the delta
        const latest = latestTimestamp(
          delta.logs,
          delta.emissions,
          delta.errors,
          delta.runs
        );
        if (latest !== undefined) cursorRef.current = latest;
      } catch {
        // Ignore malformed SSE data
      }
    });

    es.addEventListener("health", (event: MessageEvent) => {
      if (!isActiveRef.current) return;
      try {
        const health = JSON.parse(event.data) as Pick<
          LiveData,
          "memory" | "cpu" | "eventLoop" | "gc"
        >;

        setLiveData((prev) => mergeLiveData(prev, health, true));
      } catch {
        // Ignore malformed SSE data
      }
    });

    es.onopen = () => {
      setConnectionMode("sse");
      setError(null);
    };

    es.onerror = () => {
      // SSE failed — fall back to polling
      es.close();
      eventSourceRef.current = null;
      setConnectionMode("polling");
      // Start polling
      startPolling();
    };
  }, [startPolling]);

  // -----------------------------------------------------------------------
  // Lifecycle: connect SSE on mount, fall back to polling
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isActive) {
      // Paused: close SSE and stop polling
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
      return;
    }

    // Try SSE first
    if (typeof EventSource !== "undefined") {
      connectSSE();
    } else {
      // EventSource not supported — go straight to polling
      setConnectionMode("polling");
      startPolling();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
    };
  }, [isActive]);

  // Restart polling when interval changes (only relevant in polling mode)
  useEffect(() => {
    if (connectionMode !== "polling" || !isActive) return;
    startPolling();
    return () => stopPolling();
  }, [pollInterval, connectionMode]);

  // -----------------------------------------------------------------------
  // Manual refresh — works identically in both modes
  // -----------------------------------------------------------------------

  const refresh = useCallback(() => {
    fetchLiveData(cursorRef.current);
  }, [fetchLiveData]);

  return {
    liveData,
    error,
    connectionMode,
    isActive,
    setIsActive,
    pollInterval,
    setPollInterval,
    refresh,
  };
}
