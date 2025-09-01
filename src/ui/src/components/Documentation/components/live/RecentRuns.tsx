import React, { useState } from "react";
import { CodeModal } from "../CodeModal";
import "./RecentRuns.scss";

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

export const RecentRuns: React.FC<RecentRunsProps> = ({
  runs,
  errors,
  detailed = false,
}) => {
  const [selectedErrorStack, setSelectedErrorStack] = useState<string | null>(
    null
  );
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const openErrorModal = (stack: string, sourceId: string) => {
    setSelectedErrorStack(stack);
    setSelectedErrorId(sourceId);
    setShowErrorModal(true);
  };

  const closeErrorModal = () => {
    setShowErrorModal(false);
    setSelectedErrorStack(null);
    setSelectedErrorId(null);
  };
  const formatTimestamp = (timestampMs: number): string => {
    return new Date(timestampMs).toLocaleTimeString();
  };

  return (
    <div className="recent-runs">
      {/* Recent Errors */}
      {errors.length > 0 && (
        <div className="errors-section">
          <h4>❌ Recent Errors ({errors.length})</h4>
          <div className="live-entries">
            {errors
              .slice(-10)
              .reverse()
              .map((error, idx) => (
                <div
                  key={`${error.timestampMs}-${idx}`}
                  className="live-entry live-entry--error"
                >
                  <span className="entry-time">
                    {formatTimestamp(error.timestampMs)}
                  </span>
                  <a
                    href={`#element-${error.sourceId}`}
                    className="entry-source"
                  >
                    {error.sourceKind}:{error.sourceId}
                  </a>
                  {/* <span className="entry-message">{error.message}</span> */}
                  {error.stack && (
                    <div className="entry-actions">
                      <button
                        className="clean-button"
                        onClick={() =>
                          openErrorModal(error.stack!, error.sourceId)
                        }
                      >
                        View Stack Trace
                      </button>

                      <button
                        className="clean-button"
                        title="Add to AI"
                        onClick={() => {
                          const source =
                            (error.sourceResolved && error.sourceResolved.id) ||
                            error.sourceId;
                          const messageText = `I have the following error on @${source}: ${
                            error.message
                          } with stack:\n${error.stack || ""}`;
                          const displayText = messageText;
                          window.dispatchEvent(
                            new CustomEvent("docs:add-to-ai", {
                              detail: { messageText, displayText },
                            })
                          );
                        }}
                      >
                        ✦
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {runs.length > 0 && (
        <div className="runs-section">
          <h4>🏃 Recent Runs ({runs.length})</h4>
          <div className="live-entries">
            {runs
              .slice(-10)
              .reverse()
              .map((run, idx) => (
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
                  <a href={`#element-${run.nodeId}`} className="entry-node">
                    {run.nodeKind}:{run.nodeId}
                  </a>
                  {run.durationMs && (
                    <span className="entry-duration">
                      {run.durationMs.toFixed(1)}ms
                    </span>
                  )}
                  <div className="entry-actions">
                    {run.error && (
                      <button
                        className="clean-button"
                        onClick={() => openErrorModal(run.error!, run.nodeId)}
                      >
                        View Error
                      </button>
                    )}
                    {/* <button
                      className="clean-button"
                      title="Replay this task"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("docs:replay-task", {
                            detail: { 
                              nodeId: run.nodeId,
                              nodeKind: run.nodeKind
                            },
                          })
                        );
                      }}
                    >
                      🔄 Replay
                    </button> */}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      <CodeModal
        title="Error Stack Trace"
        subtitle={selectedErrorId || undefined}
        isOpen={showErrorModal}
        onClose={closeErrorModal}
        code={selectedErrorStack}
      />
    </div>
  );
};
