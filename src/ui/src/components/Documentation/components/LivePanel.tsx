import React, { useState, useEffect, useRef } from "react";
import { graphqlRequest } from "../utils/graphqlClient";
import { RecentLogs } from "./live/RecentLogs";
import { RecentEvents } from "./live/RecentEvents";
import { RecentRuns } from "./live/RecentRuns";
import { LiveRuns } from "./live/LiveRuns";
import { Introspector } from "../../../../../resources/models/Introspector";

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

interface CpuStats {
  usage: number;
  loadAverage: number;
}

interface EventLoopStats {
  lag: number;
}

interface GcStats {
  collections: number;
  duration: number;
}

interface LogEntry {
  timestampMs: number;
  level: string;
  message: string;
  data?: string;
  correlationId?: string;
}

interface EmissionEntry {
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
      tags: Array<{
        id: string;
        config?: string;
      }>;
    };
  };
}

interface ErrorEntry {
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
      tags: Array<{
        id: string;
        config?: string;
      }>;
    };
  };
}

interface RunRecord {
  timestampMs: number;
  nodeId: string;
  nodeKind: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
}

interface LiveData {
  memory: MemoryStats;
  cpu: CpuStats;
  eventLoop: EventLoopStats;
  gc: GcStats;
  logs: LogEntry[];
  emissions: EmissionEntry[];
  errors: ErrorEntry[];
  runs: RunRecord[];
}

interface LivePanelProps {
  detailed?: boolean;
  introspector: Introspector;
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

interface CpuStats {
  usage: number;
  loadAverage: number;
}

interface EventLoopStats {
  lag: number;
}

interface GcStats {
  collections: number;
  duration: number;
}

interface LogEntry {
  timestampMs: number;
  level: string;
  message: string;
  data?: string;
  correlationId?: string;
}

interface EmissionEntry {
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
      tags: Array<{
        id: string;
        config?: string;
      }>;
    };
  };
}

interface ErrorEntry {
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
      tags: Array<{
        id: string;
        config?: string;
      }>;
    };
  };
}

interface RunRecord {
  timestampMs: number;
  nodeId: string;
  nodeKind: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
}

interface LiveData {
  memory: MemoryStats;
  cpu: CpuStats;
  eventLoop: EventLoopStats;
  gc: GcStats;
  logs: LogEntry[];
  emissions: EmissionEntry[];
  errors: ErrorEntry[];
  runs: RunRecord[];
}

const LIVE_DATA_QUERY = `
  query LiveData($afterTimestamp: Float, $last: Int) {
    live {
      memory {
        heapUsed
        heapTotal
        rss
      }
      cpu {
        usage
        loadAverage
      }
      eventLoop {
        lag
      }
      gc(windowMs: 30000) {
        collections
        duration
      }
      logs(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs
        level
        message
        data
        correlationId
        sourceId
      }
      emissions(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs
        eventId
        emitterId
        payload
        correlationId
        eventResolved {
          id
          tags {
            id
            config
          }
          meta {
            title
            description
          }
        }
      }
      errors(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs
        sourceId
        sourceKind
        message
        stack
        data
        correlationId
        sourceResolved {
          id
          tags {
            id
            config
          }
          meta {
            title
            description
          }
        }
      }
      runs(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs
        nodeId
        nodeKind
        ok
        durationMs
        error
      }
    }
  }
`;

interface LivePanelProps {
  detailed?: boolean;
  introspector: Introspector;
}

export const LivePanel: React.FC<LivePanelProps> = ({
  detailed = false,
  introspector,
}) => {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastTimestamp, setLastTimestamp] = useState<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLiveData = async (afterTimestamp?: number) => {
    try {
      const variables: any = {
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
        setLiveData((prevData) => {
          if (!prevData || !afterTimestamp) {
            // Initial load or full refresh
            return data.live;
          }

          // Merge new data with existing data
          return {
            ...data.live,
            logs: [...prevData.logs, ...data.live.logs].slice(-100),
            emissions: [...prevData.emissions, ...data.live.emissions].slice(
              -100
            ),
            errors: [...prevData.errors, ...data.live.errors].slice(-100),
            runs: [...prevData.runs, ...data.live.runs].slice(-100),
          };
        });

        // Update timestamp for next poll
        const allEntries = [
          ...data.live.logs,
          ...data.live.emissions,
          ...data.live.errors,
          ...data.live.runs,
        ];

        if (allEntries.length > 0) {
          const maxTimestamp = Math.max(
            ...allEntries.map((e) => e.timestampMs)
          );
          setLastTimestamp(maxTimestamp);
        }
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live data"
      );
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLiveData();

    if (isPolling) {
      intervalRef.current = setInterval(() => {
        fetchLiveData(lastTimestamp);
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPolling, lastTimestamp]);

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (error) {
    return (
      <div className="live-panel live-panel--error">
        <div className="live-error">
          <span>❌ Error loading live data: {error}</span>
          <button onClick={() => fetchLiveData()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!liveData) {
    return (
      <div className="live-panel live-panel--loading">
        <div className="live-loading">📡 Loading live data...</div>
      </div>
    );
  }

  return (
    <div className="live-panel">
      <div className="live-controls">
        <button
          onClick={() => setIsPolling(!isPolling)}
          className={`live-toggle ${isPolling ? "live-toggle--active" : ""}`}
        >
          {isPolling ? "⏸️ Pause" : "▶️ Resume"} Live Updates
        </button>
        <button onClick={() => fetchLiveData()} className="live-refresh">
          🔄 Refresh
        </button>
      </div>

      {/* Main Grid Layout */}
      <div
        className="live-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "20px",
        }}
      >
        {/* System Health - Full Width */}
        <div className="live-section live-section--health">
          <h3>🖥️ System Health</h3>
          <div
            className="health-metrics"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "20px",
            }}
          >
            <div className="metric">
              <span className="metric-label">Memory</span>
              <span className="metric-value">
                {formatBytes(liveData.memory.heapUsed)} /{" "}
                {formatBytes(liveData.memory.heapTotal)}
              </span>
              <div className="metric-detail">
                RSS: {formatBytes(liveData.memory.rss)}
              </div>
            </div>
            <div className="metric">
              <span className="metric-label">CPU Usage</span>
              <span className="metric-value">
                {(liveData.cpu.usage * 100).toFixed(1)}%
              </span>
              <div className="metric-detail">
                Load: {liveData.cpu.loadAverage.toFixed(2)}
              </div>
            </div>
            <div className="metric">
              <span className="metric-label">Event Loop</span>
              <span className="metric-value">
                {liveData.eventLoop.lag.toFixed(2)}ms
              </span>
              <div className="metric-detail">Lag</div>
            </div>
            <div className="metric">
              <span className="metric-label">GC (30s)</span>
              <span className="metric-value">{liveData.gc.collections}</span>
              <div className="metric-detail">
                {liveData.gc.duration.toFixed(1)}ms total
              </div>
            </div>
          </div>
        </div>

        {/* Logs - Full Width */}
        <div className="live-logs-section">
          <RecentLogs logs={liveData.logs} />
        </div>

        {/* Recent Events and Runs - Side by Side */}
        <div
          className="live-events-runs-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <RecentEvents emissions={liveData.emissions} detailed={detailed} />
          <RecentRuns
            runs={liveData.runs}
            errors={liveData.errors}
            detailed={detailed}
          />
        </div>

        {/* Live Actions - Full Width */}
        <div className="live-actions-section">
          <LiveRuns introspector={introspector} />
        </div>
      </div>
    </div>
  );
};
