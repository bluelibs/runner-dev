import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import JsonViewer from "../JsonViewer";

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

export const RecentLogs: React.FC<RecentLogsProps> = ({ logs }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  const formatTimestamp = (timestampMs: number): string => {
    const d = new Date(timestampMs);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
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

  const tryParseJson = (jsonString: string): object | null => {
    try {
      const json = JSON.parse(jsonString);
      return typeof json === "object" && json !== null ? json : null;
    } catch (e) {
      return null;
    }
  };

  const visibleLogs = useMemo(() => {
    const base = isFullscreen ? logs : logs.slice(-10);
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
    <div
      className="live-section"
      style={{
        marginBottom: "20px",
        position: "relative",
        background: "#ffffff",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        padding: "16px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: "500",
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Recent Logs ({logs.length})
        </h3>
        <button
          type="button"
          className="clean-button"
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          title={isFullscreen ? "Exit full screen" : "Enter full screen"}
          onClick={() => setIsFullscreen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            padding: "4px 8px",
            color: "#6b7280",
            fontSize: "12px",
            fontWeight: "400",
            transition: "all 0.15s ease",
            cursor: "pointer",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#f3f4f6";
            e.currentTarget.style.color = "#374151";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#6b7280";
          }}
        >
          <span>{isFullscreen ? "Exit" : "Expand"}</span>
        </button>
      </div>

      <div
        className="live-entries"
        style={{
          maxHeight: isFullscreen ? "80vh" : "300px",
          overflowY: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          background: "#f9fafb",
          color: "#374151",
          boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.05)",
          padding: "8px",
        }}
      >
        {visibleLogs.map((log, idx) => (
          <div
            key={`${log.timestampMs}-${idx}`}
            className="live-entry live-entry--log"
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
              borderBottom:
                idx === visibleLogs.length - 1 ? "none" : "1px solid #f3f4f6",
              cursor: "pointer",
              transition: "background-color 0.1s ease",
              fontSize: "13px",
            }}
            onClick={() => setSelectedLogIndex(idx)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              className="entry-time"
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                color: "#9ca3af",
                fontWeight: "400",
                whiteSpace: "nowrap",
              }}
            >
              {new Date(log.timestampMs).toLocaleTimeString()}
            </span>
            <span
              className="entry-level"
              style={{
                color: getLogLevelColor(log.level),
                fontWeight: 500,
                textTransform: "uppercase",
                fontSize: "10px",
                background: `${getLogLevelColor(log.level)}15`,
                padding: "2px 6px",
                borderRadius: "2px",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              {log.level}
            </span>
            <span
              className="entry-message"
              style={{
                color: "#374151",
                fontSize: "13px",
                lineHeight: "1.4",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {log.message}
            </span>
            <button
              type="button"
              className="clean-button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLogIndex(idx);
              }}
              title="View details"
              style={{
                background: "transparent",
                border: "1px solid #d1d5db",
                color: "#6b7280",
                padding: "2px 6px",
                borderRadius: "3px",
                fontSize: "11px",
                fontWeight: "400",
                transition: "all 0.1s ease",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.color = "#374151";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#6b7280";
              }}
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
            style={{
              position: "fixed",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
              backdropFilter: "blur(8px)",
              zIndex: 2147483646,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={() => setIsFullscreen(false)}
          >
            <div
              style={{
                position: "relative",
                width: "min(1400px, 96vw)",
                height: "min(900px, 92vh)",
                background:
                  "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)",
                color: "var(--panel-fg, #f1f5f9)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "16px",
                boxShadow:
                  "0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                backdropFilter: "blur(16px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  paddingBottom: "16px",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.5rem",
                    fontWeight: "600",
                    color: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.75rem",
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
                    }}
                  >
                    📝
                  </span>
                  Recent Logs - Full Screen
                </h3>
                <button
                  className="clean-button"
                  onClick={() => setIsFullscreen(false)}
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)";
                    e.currentTarget.style.borderColor =
                      "rgba(239, 68, 68, 0.5)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(239, 68, 68, 0.15)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)";
                    e.currentTarget.style.borderColor =
                      "rgba(239, 68, 68, 0.3)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Close
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  border: "1px solid rgba(71, 85, 105, 0.3)",
                  borderRadius: "12px",
                  padding: "16px",
                  background:
                    "linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)",
                  backdropFilter: "blur(4px)",
                }}
              >
                {visibleLogs.map((log, idx) => (
                  <div
                    key={`fs-${log.timestampMs}-${idx}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto auto 1fr auto",
                      gap: 16,
                      padding: "16px 18px",
                      borderRadius: "10px",
                      marginBottom: "8px",
                      background:
                        idx % 2 === 0
                          ? "linear-gradient(135deg, rgba(51, 65, 85, 0.3) 0%, rgba(71, 85, 105, 0.2) 100%)"
                          : "linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(51, 65, 85, 0.2) 100%)",
                      border: "1px solid rgba(148, 163, 184, 0.1)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      alignItems: "start",
                    }}
                    onClick={() => setSelectedLogIndex(idx)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.1) 100%)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.3)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px rgba(0, 0, 0, 0.15)";
                    }}
                    onMouseOut={(e) => {
                      const baseColor =
                        idx % 2 === 0
                          ? "linear-gradient(135deg, rgba(51, 65, 85, 0.3) 0%, rgba(71, 85, 105, 0.2) 100%)"
                          : "linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(51, 65, 85, 0.2) 100%)";
                      e.currentTarget.style.background = baseColor;
                      e.currentTarget.style.borderColor =
                        "rgba(148, 163, 184, 0.1)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.875rem",
                        color: "#94a3b8",
                        fontWeight: "500",
                        background: "rgba(15, 23, 42, 0.5)",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(71, 85, 105, 0.3)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTimestamp(log.timestampMs)}
                    </span>
                    <span
                      style={{
                        color: getLogLevelColor(log.level),
                        fontWeight: 700,
                        textTransform: "uppercase",
                        fontSize: "0.875rem",
                        background: `${getLogLevelColor(log.level)}15`,
                        border: `1px solid ${getLogLevelColor(log.level)}40`,
                        padding: "6px 10px",
                        borderRadius: "8px",
                        letterSpacing: "0.5px",
                        textShadow: `0 1px 2px ${getLogLevelColor(
                          log.level
                        )}40`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.level}
                    </span>
                    <span
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.6",
                        color: "#f1f5f9",
                        fontSize: "1rem",
                      }}
                    >
                      {log.message}
                    </span>
                    <button
                      className="clean-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLogIndex(idx);
                      }}
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "#a855f7",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)";
                        e.currentTarget.style.borderColor =
                          "rgba(168, 85, 247, 0.5)";
                        e.currentTarget.style.boxShadow =
                          "0 3px 10px rgba(168, 85, 247, 0.2)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)";
                        e.currentTarget.style.borderColor =
                          "rgba(168, 85, 247, 0.3)";
                        e.currentTarget.style.boxShadow = "none";
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
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 2147483647,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => setSelectedLogIndex(null)}
          >
            <div
              style={{
                width: "min(800px, 95vw)",
                maxHeight: "90vh",
                overflow: "hidden",
                background: "#ffffff",
                color: "#1f2937",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow:
                  "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "16px 20px",
                  borderBottom: "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#1f2937",
                  }}
                >
                  Log Details
                </h3>
                <button
                  className="clean-button"
                  onClick={() => setSelectedLogIndex(null)}
                  style={{
                    background: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    color: "#6b7280",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    transition: "all 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#e5e7eb";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  Close
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns:
                      window.innerWidth > 768 ? "300px 1fr" : "1fr",
                  }}
                >
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#6b7280",
                          marginBottom: "6px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Timestamp
                      </div>
                      <div
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "4px",
                          padding: "8px",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: "12px",
                          color: "#374151",
                        }}
                      >
                        {formatTimestamp(selectedLog.timestampMs)}
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#6b7280",
                          marginBottom: "6px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Level
                      </div>
                      <span
                        style={{
                          color: getLogLevelColor(selectedLog.level),
                          fontWeight: 500,
                          textTransform: "uppercase",
                          fontSize: "11px",
                          background: `${getLogLevelColor(
                            selectedLog.level
                          )}15`,
                          padding: "3px 6px",
                          borderRadius: "3px",
                          letterSpacing: "0.3px",
                          display: "inline-block",
                        }}
                      >
                        {selectedLog.level}
                      </span>
                    </div>

                    {selectedLog.correlationId && (
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "500",
                            color: "#6b7280",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Correlation ID
                        </div>
                        <div
                          style={{
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            borderRadius: "4px",
                            padding: "8px",
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "11px",
                            color: "#374151",
                            wordBreak: "break-all",
                          }}
                        >
                          {selectedLog.correlationId}
                        </div>
                      </div>
                    )}

                    {selectedLog.sourceId && (
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "500",
                            color: "#6b7280",
                            marginBottom: "6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Source
                        </div>
                        <a
                          href={`#element-${selectedLog.sourceId}`}
                          style={{
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            color: "#16a34a",
                            padding: "4px 8px",
                            borderRadius: "3px",
                            fontSize: "11px",
                            fontWeight: "400",
                            textDecoration: "none",
                            display: "inline-block",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          #{selectedLog.sourceId}
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "500",
                          color: "#6b7280",
                          marginBottom: "6px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Message
                      </div>
                      <div
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "4px",
                          padding: "12px",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          lineHeight: "1.4",
                          fontSize: "13px",
                          color: "#374151",
                          maxHeight: "120px",
                          overflowY: "auto",
                        }}
                      >
                        {selectedLog.message}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "500",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Data
                        </div>
                        {selectedLog.data && (
                          <button
                            className="clean-button"
                            onClick={() => {
                              const raw = selectedLog.data ?? "";
                              navigator.clipboard
                                .writeText(raw)
                                .catch(() => {});
                            }}
                            style={{
                              background: "transparent",
                              border: "1px solid #d1d5db",
                              color: "#6b7280",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              fontSize: "10px",
                              fontWeight: "400",
                              cursor: "pointer",
                            }}
                          >
                            Copy
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "4px",
                          padding: "12px",
                          maxHeight: "200px",
                          overflow: "auto",
                          background: "#f9fafb",
                        }}
                      >
                        {selectedLog.data ? (
                          (() => {
                            const parsed = tryParseJson(selectedLog.data!);
                            if (parsed) {
                              return <JsonViewer data={parsed} />;
                            }
                            return (
                              <pre
                                style={{
                                  wordBreak: "break-word",
                                  whiteSpace: "pre-wrap",
                                  margin: 0,
                                  fontSize: "12px",
                                  lineHeight: "1.3",
                                  color: "#374151",
                                  fontFamily: "ui-monospace, monospace",
                                }}
                              >
                                {selectedLog.data}
                              </pre>
                            );
                          })()
                        ) : (
                          <div
                            style={{
                              textAlign: "center",
                              color: "#9ca3af",
                              fontSize: "12px",
                              padding: "16px",
                            }}
                          >
                            No data available
                          </div>
                        )}
                      </div>
                    </div>
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
