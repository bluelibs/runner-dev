import React, { useState, useEffect, useRef } from "react";
import { graphqlRequest } from "../utils/graphqlClient";

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
      }
      emissions(afterTimestamp: $afterTimestamp, last: $last) {
        timestampMs
        eventId
        emitterId
        payload
        correlationId
        eventResolved {
          id
          meta {
            title
            description
            tags {
              id
              config
            }
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
          meta {
            title
            description
            tags {
              id
              config
            }
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
}

export const LivePanel: React.FC<LivePanelProps> = ({ detailed = false }) => {
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

  const formatTimestamp = (timestampMs: number): string => {
    return new Date(timestampMs).toLocaleTimeString();
  };

  const getLogLevelColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case "error":
      case "fatal":
        return "#ef4444";
      case "warn":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      case "debug":
        return "#6b7280";
      case "trace":
        return "#9ca3af";
      default:
        return "#374151";
    }
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

      <div className="live-grid">
        {/* System Health */}
        <div className="live-section live-section--health">
          <h3>🖥️ System Health</h3>
          <div className="health-metrics">
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

        {/* Recent Logs */}
        <div className="live-section live-section--logs">
          <h3>📝 Recent Logs ({liveData.logs.length})</h3>
          <div className="live-entries">
            {liveData.logs.slice(-10).map((log, idx) => (
              <div
                key={`${log.timestampMs}-${idx}`}
                className="live-entry live-entry--log"
              >
                <span className="entry-time">
                  {formatTimestamp(log.timestampMs)}
                </span>
                <span
                  className="entry-level"
                  style={{ color: getLogLevelColor(log.level) }}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="entry-message">{log.message}</span>
                {log.data && (
                  <details className="entry-data">
                    <summary>Data</summary>
                    <pre>{log.data}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Errors */}
        {liveData.errors.length > 0 && (
          <div className="live-section live-section--errors">
            <h3>❌ Recent Errors ({liveData.errors.length})</h3>
            <div className="live-entries">
              {liveData.errors.slice(-5).map((error, idx) => (
                <div
                  key={`${error.timestampMs}-${idx}`}
                  className="live-entry live-entry--error"
                >
                  <span className="entry-time">
                    {formatTimestamp(error.timestampMs)}
                  </span>
                  <span className="entry-source">
                    {error.sourceKind}:{error.sourceId}
                  </span>
                  <span className="entry-message">{error.message}</span>
                  {error.stack && detailed && (
                    <details className="entry-stack">
                      <summary>Stack Trace</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        {liveData.emissions.length > 0 && (
          <div className="live-section live-section--events">
            <h3>📡 Recent Events ({liveData.emissions.length})</h3>
            <div className="live-entries">
              {liveData.emissions.slice(-10).map((emission, idx) => (
                <div
                  key={`${emission.timestampMs}-${idx}`}
                  className="live-entry live-entry--emission"
                >
                  <span className="entry-time">
                    {formatTimestamp(emission.timestampMs)}
                  </span>
                  <span className="entry-event">{emission.eventId}</span>
                  {emission.emitterId && (
                    <span className="entry-emitter">
                      from {emission.emitterId}
                    </span>
                  )}
                  {emission.payload && detailed && (
                    <details className="entry-payload">
                      <summary>Payload</summary>
                      <pre>{emission.payload}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Runs */}
        {liveData.runs.length > 0 && (
          <div className="live-section live-section--runs">
            <h3>🏃 Recent Runs ({liveData.runs.length})</h3>
            <div className="live-entries">
              {liveData.runs.slice(-10).map((run, idx) => (
                <div
                  key={`${run.timestampMs}-${idx}`}
                  className={`live-entry live-entry--run ${
                    run.ok ? "live-entry--success" : "live-entry--failure"
                  }`}
                >
                  <span className="entry-time">
                    {formatTimestamp(run.timestampMs)}
                  </span>
                  <span className="entry-status">{run.ok ? "✅" : "❌"}</span>
                  <span className="entry-node">
                    {run.nodeKind}:{run.nodeId}
                  </span>
                  {run.durationMs && (
                    <span className="entry-duration">
                      {run.durationMs.toFixed(1)}ms
                    </span>
                  )}
                  {run.error && (
                    <span className="entry-error">{run.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
