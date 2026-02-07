import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import JsonViewer from "../JsonViewer";
import "./RecentLogs.scss";

interface LogEntry {
  timestampMs: number;
  level: string;
  message: string;
  data?: string;
  sourceId?: string;
  correlationId?: string;
}

interface RecentLogsProps {
  logs: LogEntry[];
}

const levelName = (
  level: string
): "error" | "warn" | "info" | "debug" | "trace" | "default" => {
  const l = level.toLowerCase();
  if (l === "fatal" || l === "error") return "error";
  if (l === "warn" || l === "warning") return "warn";
  if (l === "info") return "info";
  if (l === "debug") return "debug";
  if (l === "trace") return "trace";
  return "default";
};

const shortCorrelationId = (id: string, len = 6): string => {
  if (!id) return "";
  return id.length > len ? id.slice(-len) : id;
};

export const RecentLogs: React.FC<RecentLogsProps> = ({ logs }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  const formatTimestamp = (timestampMs: number): string => {
    const d = new Date(timestampMs);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };

  const tryParseJson = (jsonString: string): object | null => {
    try {
      const json = JSON.parse(jsonString);
      return typeof json === "object" && json !== null ? json : null;
    } catch {
      return null;
    }
  };

  const visibleLogs = useMemo(() => {
    const base = isFullscreen ? logs : logs.slice(-50);
    return [...base].reverse();
  }, [logs, isFullscreen]);

  const selectedLog = useMemo(() => {
    if (selectedLogIndex === null) return null;
    return visibleLogs[selectedLogIndex] ?? null;
  }, [selectedLogIndex, visibleLogs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedLogIndex !== null) {
          setSelectedLogIndex(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, selectedLogIndex]);

  return (
    <div className="recent-logs live-section">
      <div className="recent-logs__header">
        <h4 className="recent-logs__title">Recent Logs ({logs.length})</h4>
        <button
          type="button"
          className="recent-logs__toggle"
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          title={isFullscreen ? "Exit full screen" : "Enter full screen"}
          onClick={() => setIsFullscreen((v) => !v)}
        >
          <span>{isFullscreen ? "Exit" : "Expand"}</span>
        </button>
      </div>

      <div
        className={`recent-logs__list ${
          isFullscreen ? "recent-logs__list--expanded" : ""
        }`}
      >
        {visibleLogs.map((log, idx) => (
          <div
            key={`${log.timestampMs}-${idx}`}
            className={`recent-logs__row recent-logs__row--compact`}
            onClick={() => setSelectedLogIndex(idx)}
          >
            <span className="recent-logs__time">
              {new Date(log.timestampMs).toLocaleTimeString()}
            </span>
            <span
              className={`recent-logs__level recent-logs__level--${levelName(
                log.level
              )}`}
            >
              {log.level}
            </span>
            <span className="recent-logs__message">{log.message}</span>
            {log.correlationId && (
              <span className="recent-logs__corr" title={log.correlationId}>
                {shortCorrelationId(log.correlationId)}
              </span>
            )}
            {log.sourceId && (
              <a
                href={`#element-${log.sourceId}`}
                onClick={(e) => e.stopPropagation()}
                title={`Go to source #${log.sourceId}`}
                className="recent-logs__source"
              >
                #{log.sourceId}
              </a>
            )}
            <button
              type="button"
              className="recent-logs__action"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLogIndex(idx);
              }}
              title="View details"
            >
              View
            </button>
          </div>
        ))}
      </div>

      {isFullscreen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="recent-logs-fs__overlay"
            onClick={() => setIsFullscreen(false)}
          >
            <div
              className="recent-logs-fs__panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="recent-logs-fs__header">
                <h3 className="recent-logs-fs__title">
                  Recent Logs - Full Screen
                </h3>
                <button
                  className="recent-logs-fs__close"
                  onClick={() => setIsFullscreen(false)}
                >
                  Close
                </button>
              </div>
              <div className="recent-logs-fs__content">
                {visibleLogs.map((log, idx) => (
                  <div
                    key={`fs-${log.timestampMs}-${idx}`}
                    className="recent-logs__row recent-logs__row--fullscreen"
                    onClick={() => setSelectedLogIndex(idx)}
                  >
                    <span className="recent-logs-fs__time">
                      {formatTimestamp(log.timestampMs)}
                    </span>
                    <span
                      className={`recent-logs-fs__level recent-logs-fs__level--${levelName(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>
                    <span className="recent-logs-fs__message">
                      {log.message}
                    </span>
                    {log.correlationId && (
                      <span
                        className="recent-logs-fs__corr"
                        title={`Correlation ID: ${log.correlationId}`}
                      >
                        {shortCorrelationId(log.correlationId)}
                      </span>
                    )}
                    {log.sourceId && (
                      <a
                        href={`#element-${log.sourceId}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`Go to source #${log.sourceId}`}
                        className="recent-logs-fs__source"
                      >
                        #{log.sourceId}
                      </a>
                    )}
                    <button
                      className="recent-logs-fs__action"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLogIndex(idx);
                      }}
                    >
                      Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {selectedLog &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="recent-logs-modal__overlay"
            onClick={() => setSelectedLogIndex(null)}
          >
            <div
              className="recent-logs-modal__panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="recent-logs-modal__header">
                <h3 className="recent-logs-modal__title">Log Details</h3>
                <button
                  className="recent-logs-modal__close"
                  onClick={() => setSelectedLogIndex(null)}
                >
                  Close
                </button>
              </div>
              <div className="recent-logs-modal__content">
                <div className="recent-logs-modal__grid">
                  <div>
                    <div className="recent-logs-modal__field">
                      <div className="recent-logs-modal__label">Timestamp</div>
                      <div className="recent-logs-modal__value recent-logs-modal__value--mono">
                        {formatTimestamp(selectedLog.timestampMs)}
                      </div>
                    </div>

                    <div className="recent-logs-modal__field">
                      <div className="recent-logs-modal__label">Level</div>
                      <span
                        className={`recent-logs-modal__level recent-logs-modal__level--${levelName(
                          selectedLog.level
                        )}`}
                      >
                        {selectedLog.level}
                      </span>
                    </div>

                    {selectedLog.correlationId && (
                      <div className="recent-logs-modal__field">
                        <div className="recent-logs-modal__label">
                          Correlation ID
                        </div>
                        <div className="recent-logs-modal__value recent-logs-modal__value--mono recent-logs-modal__value--break">
                          {selectedLog.correlationId}
                        </div>
                      </div>
                    )}

                    {selectedLog.sourceId && (
                      <div className="recent-logs-modal__field">
                        <div className="recent-logs-modal__label">Source</div>
                        <a
                          href={`#element-${selectedLog.sourceId}`}
                          className="recent-logs-modal__source"
                        >
                          #{selectedLog.sourceId}
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="recent-logs-modal__field">
                      <div className="recent-logs-modal__label">Message</div>
                      <div className="recent-logs-modal__message">
                        {selectedLog.message}
                      </div>
                    </div>

                    {selectedLog.data && selectedLog.data !== "{}" && (
                      <div>
                        <div className="recent-logs-modal__data-header">
                          <div className="recent-logs-modal__label">Data</div>
                          <button
                            className="recent-logs-modal__copy"
                            onClick={() => {
                              const raw = selectedLog.data ?? "";
                              navigator.clipboard
                                .writeText(raw)
                                .catch(() => {});
                            }}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="recent-logs-modal__data">
                          {(() => {
                            const parsed = tryParseJson(selectedLog.data!);
                            if (parsed) {
                              return <JsonViewer data={parsed} />;
                            }
                            return (
                              <pre className="recent-logs-modal__pre">
                                {selectedLog.data}
                              </pre>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
