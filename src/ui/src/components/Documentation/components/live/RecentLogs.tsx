import React from "react";
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

  const tryParseJson = (jsonString: string): object | null => {
    try {
      const json = JSON.parse(jsonString);
      return typeof json === "object" && json !== null ? json : null;
    } catch (e) {
      return null;
    }
  };

  return (
    <div
      className="live-section live-section--logs"
      style={{ marginBottom: "20px" }}
    >
      <h3>📝 Recent Logs ({logs.length})</h3>
      <div 
        className="live-entries"
        style={{ 
          maxHeight: "300px",
          overflowY: "auto",
          border: "none"
        }}
      >
        {logs
          .slice(-10)
          .reverse()
          .map((log, idx) => (
            <div
              key={`${log.timestampMs}-${idx}`}
              className="live-entry live-entry--log"
              style={{ border: "none", borderLeft: "none" }}
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
              <span 
                className="entry-message"
                style={{ 
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap"
                }}
              >
                {log.message}
              </span>
              {log.sourceId && (
                <a href={`#element-${log.sourceId}`} className="clean-button">
                  Source
                </a>
              )}
              {log.data &&
                (() => {
                  const jsonData = tryParseJson(log.data);
                  return (
                    <details className="entry-data">
                      <summary>Data</summary>
                      {jsonData ? (
                        <JsonViewer data={jsonData} />
                      ) : (
                        <pre style={{ 
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap"
                        }}>{log.data}</pre>
                      )}
                    </details>
                  );
                })()}
            </div>
          ))}
      </div>
    </div>
  );
};
