import { useState, useEffect, useRef, useCallback } from "react";
import { graphqlRequest } from "../utils/graphqlClient";
import {
  advanceCursors,
  emptyCursors,
  keepUnseenEntries,
} from "./liveTelemetryCursors";
import { pollLiveTelemetry } from "./liveTelemetryPolling";
import type {
  LiveData,
  TelemetryCursors,
  TelemetryDelta,
} from "./liveTelemetry.types";

export type {
  CpuStats,
  EmissionEntry,
  ErrorEntry,
  EventLoopStats,
  GcStats,
  LiveData,
  LogEntry,
  MemoryStats,
  RunRecord,
} from "./liveTelemetry.types";

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
// Merge helper
// ---------------------------------------------------------------------------

const EMPTY_LIVE_DATA: LiveData = {
  memory: { heapUsed: 0, heapTotal: 0, rss: 0 },
  cpu: { usage: 0, loadAverage: 0 },
  eventLoop: { lag: 0 },
  gc: { collections: 0, duration: 0 },
  logs: [],
  emissions: [],
  errors: [],
  runs: [],
};

function appendRecent<T>(existing: T[], incoming: T[] | undefined): T[] {
  if (!incoming || incoming.length === 0) return existing;
  return [...existing, ...incoming].slice(-MAX_BUFFER_ENTRIES);
}

function mergeLiveData(
  prev: LiveData | null,
  incoming: Partial<LiveData>
): LiveData {
  const base = prev ?? EMPTY_LIVE_DATA;
  return {
    memory: incoming.memory ?? base.memory,
    cpu: incoming.cpu ?? base.cpu,
    eventLoop: incoming.eventLoop ?? base.eventLoop,
    gc: incoming.gc ?? base.gc,
    logs: appendRecent(base.logs, incoming.logs),
    emissions: appendRecent(base.emissions, incoming.emissions),
    errors: appendRecent(base.errors, incoming.errors),
    runs: appendRecent(base.runs, incoming.runs),
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

  // Per-category sequence cursors shared by SSE and polling, so switching
  // transport resumes exactly where the other one stopped.
  const cursorsRef = useRef<TelemetryCursors>(emptyCursors());
  const pollInFlightRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const setPollInterval = useCallback((ms: number) => {
    setPollIntervalRaw(
      Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, ms))
    );
  }, []);

  /** Merges an update, keeping only entries past each category's cursor. */
  const applyUpdate = useCallback(
    (health: Partial<LiveData>, delta: TelemetryDelta) => {
      const unseen = keepUnseenEntries(delta, cursorsRef.current);
      cursorsRef.current = advanceCursors(cursorsRef.current, delta);
      setLiveData((prev) => mergeLiveData(prev, { ...health, ...unseen }));
    },
    []
  );

  // -----------------------------------------------------------------------
  // Polling fallback
  // -----------------------------------------------------------------------

  const fetchLiveData = useCallback(async () => {
    // A slow drain must not overlap the next tick with the same cursors.
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const { health, delta } = await pollLiveTelemetry(graphqlRequest, {
        cursors: cursorsRef.current,
        historySize: detailed ? 50 : 10,
      });
      applyUpdate(health, delta);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live data"
      );
    } finally {
      pollInFlightRef.current = false;
    }
  }, [detailed, applyUpdate]);

  // -----------------------------------------------------------------------
  // Polling start/stop
  // -----------------------------------------------------------------------

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Initial fetch
    void fetchLiveData();

    pollTimerRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      void fetchLiveData();
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

  const closeEventSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  // Only the lifecycle effect below opens streams, and its cleanup always
  // closes the previous one first.
  const connectSSE = useCallback(() => {
    const url = new URL("/live/stream", getBaseUrl()).toString();
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("telemetry", (event: MessageEvent) => {
      if (!isActiveRef.current) return;
      try {
        const raw = JSON.parse(event.data) as TelemetryDelta;
        // The stream always carries all four categories; a missing list
        // means nothing new, which still settles an unset cursor.
        applyUpdate(
          {},
          {
            logs: raw.logs ?? [],
            emissions: raw.emissions ?? [],
            errors: raw.errors ?? [],
            runs: raw.runs ?? [],
          }
        );
      } catch {
        // Ignore malformed SSE data
      }
    });

    es.addEventListener("health", (event: MessageEvent) => {
      if (!isActiveRef.current) return;
      try {
        const health = JSON.parse(event.data) as Partial<LiveData>;
        applyUpdate(health, {});
      } catch {
        // Ignore malformed SSE data
      }
    });

    es.onopen = () => {
      setConnectionMode("sse");
      setError(null);
    };

    es.onerror = () => {
      // SSE failed — fall back to polling, continuing from the cursors the
      // stream already advanced.
      es.close();
      eventSourceRef.current = null;
      setConnectionMode("polling");
      startPolling();
    };
  }, [applyUpdate, startPolling]);

  // -----------------------------------------------------------------------
  // Lifecycle: connect SSE on mount, fall back to polling
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Pausing needs no work here: the previous run's cleanup already closed
    // the stream and stopped polling.
    if (!isActive) return;

    // Try SSE first
    if (typeof EventSource !== "undefined") {
      connectSSE();
    } else {
      // EventSource not supported — go straight to polling
      setConnectionMode("polling");
      startPolling();
    }

    return () => {
      closeEventSource();
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
    void fetchLiveData();
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
