import React from "react";

interface RunRecord {
  timestampMs: number;
  nodeId: string;
  nodeKind: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
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

interface RecentRunsProps {
  runs: RunRecord[];
  errors: ErrorEntry[];
  detailed?: boolean;
}

export const RecentRuns: React.FC<RecentRunsProps> = ({ runs, errors, detailed = false }) => {
  const formatTimestamp = (timestampMs: number): string => {
    return new Date(timestampMs).toLocaleTimeString();
  };

  return (
    <div className="live-section live-section--combined">
      {/* Recent Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <h4>❌ Recent Errors ({errors.length})</h4>
          <div className="live-entries">
            {errors.slice(-3).map((error, idx) => (
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

      {/* Recent Runs */}
      {runs.length > 0 && (
        <div>
          <h4>🏃 Recent Runs ({runs.length})</h4>
          <div className="live-entries">
            {runs.slice(-3).map((run, idx) => (
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
  );
};