import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import JsonViewer from "../JsonViewer";
import { BaseModal } from "../modals";
import "./RecentLogs.scss";

/**
 * Case-insensitive, token-based fuzzy match.
 * Every whitespace-separated token in `query` must appear in at least one of
 * the searchable fields (correlationId, sourceId, message, level, data).
 */
const fuzzyMatchLog = (log: LogEntry, query: string): boolean => {
  if (!query) return true;

  const haystack = [
    log.message,
    log.level,
    log.correlationId ?? "",
    log.sourceId ?? "",
    log.data ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
};

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
  onCorrelationIdClick?: (correlationId: string) => void;
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

const isEmptyJsonLikeValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

/** Maximum characters shown for a message in fullscreen log rows. */
const MAX_MESSAGE_PREVIEW = 200;

export const RecentLogs: React.FC<RecentLogsProps> = ({
  logs,
  onCorrelationIdClick,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fsSearchInputRef = useRef<HTMLInputElement>(null);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSelectedLogIndex(null);
  }, []);

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
    const reversed = [...base].reverse();
    if (!searchQuery) return reversed;
    return reversed.filter((log) => fuzzyMatchLog(log, searchQuery));
  }, [logs, isFullscreen, searchQuery]);

  const selectedLog = useMemo(() => {
    if (selectedLogIndex === null) return null;
    return visibleLogs[selectedLogIndex] ?? null;
  }, [selectedLogIndex, visibleLogs]);

  const selectedLogData = useMemo(() => {
    if (!selectedLog) {
      return {
        hasData: false,
        raw: "",
        parsed: null as object | null,
      };
    }

    const raw = selectedLog.data?.trim() ?? "";
    if (!raw) {
      return {
        hasData: false,
        raw: "",
        parsed: null as object | null,
      };
    }

    if (raw.toLowerCase() === "null") {
      return {
        hasData: false,
        raw: "",
        parsed: null as object | null,
      };
    }

    const parsed = tryParseJson(raw);
    if (parsed && isEmptyJsonLikeValue(parsed)) {
      return {
        hasData: false,
        raw: "",
        parsed: null as object | null,
      };
    }

    return {
      hasData: true,
      raw,
      parsed,
    };
  }, [selectedLog]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape cascade: detail modal and fullscreen overlay are handled by
      // BaseModal's stack. We only handle clearing the search query here.
      if (e.key === "Escape") {
        if (selectedLogIndex === null && !isFullscreen && searchQuery) {
          clearSearch();
        }
      }

      // Ctrl/Cmd+F focuses the search input
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        const target = isFullscreen ? fsSearchInputRef : searchInputRef;
        if (target.current) {
          e.preventDefault();
          target.current.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, selectedLogIndex, searchQuery, clearSearch]);

  return (
    <div className="recent-logs live-section">
      <div className="recent-logs__header">
        <h4 className="recent-logs__title">Recent Logs ({logs.length})</h4>
        <div className="recent-logs__search">
          <span className="recent-logs__search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className="recent-logs__search-input"
            placeholder="Search logs… (id, source, message, level)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedLogIndex(null);
            }}
            aria-label="Search logs"
          />
          {searchQuery && (
            <button
              type="button"
              className="recent-logs__search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <span className="recent-logs__match-count">
            {visibleLogs.length} match{visibleLogs.length !== 1 ? "es" : ""}
          </span>
        )}
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
        {searchQuery && visibleLogs.length === 0 ? (
          <div className="recent-logs__empty">
            <span className="recent-logs__empty-icon">🔍</span>
            <p className="recent-logs__empty-text">No logs found</p>
            <p className="recent-logs__empty-hint">
              Try adjusting your search query
            </p>
          </div>
        ) : (
          visibleLogs.map((log, idx) => (
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
                <span
                  className="recent-logs__corr recent-logs__corr--clickable"
                  title={`Trace: ${log.correlationId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCorrelationIdClick?.(log.correlationId!);
                  }}
                >
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
          ))
        )}
      </div>

      <BaseModal
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title="Recent Logs - Full Screen"
        size="fullscreen"
        className="recent-logs-fs__panel"
        ariaLabel="Recent Logs fullscreen view"
        renderHeader={({ onClose: closeFs }) => (
          <div className="recent-logs-fs__header">
            <h3 className="recent-logs-fs__title">Recent Logs - Full Screen</h3>
            <div className="recent-logs-fs__search">
              <span className="recent-logs-fs__search-icon" aria-hidden="true">
                ⌕
              </span>
              <input
                ref={fsSearchInputRef}
                type="text"
                className="recent-logs-fs__search-input"
                placeholder="Search logs… (id, source, message, level)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedLogIndex(null);
                }}
                aria-label="Search logs"
                autoFocus
              />
              <div className="recent-logs-fs__search-actions">
                <button
                  type="button"
                  className={`recent-logs-fs__search-clear ${
                    searchQuery ? "" : "recent-logs-fs__search-clear--hidden"
                  }`}
                  onClick={clearSearch}
                  aria-label="Clear search"
                  disabled={!searchQuery}
                >
                  ✕
                </button>
                <span
                  className={`recent-logs-fs__match-count ${
                    searchQuery ? "" : "recent-logs-fs__match-count--hidden"
                  }`}
                >
                  {visibleLogs.length} match
                  {visibleLogs.length !== 1 ? "es" : ""}
                </span>
              </div>
            </div>
            <button className="recent-logs-fs__close" onClick={closeFs}>
              Close
            </button>
          </div>
        )}
      >
        <div className="recent-logs-fs__content">
          {searchQuery && visibleLogs.length === 0 ? (
            <div className="recent-logs-fs__empty">
              <span className="recent-logs-fs__empty-icon">🔍</span>
              <p className="recent-logs-fs__empty-text">No logs found</p>
              <p className="recent-logs-fs__empty-hint">
                Try adjusting your search query
              </p>
            </div>
          ) : (
            visibleLogs.map((log, idx) => (
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
                <div className="recent-logs-fs__message-cell">
                  <span className="recent-logs-fs__message">
                    {log.message.length > MAX_MESSAGE_PREVIEW
                      ? log.message.slice(0, MAX_MESSAGE_PREVIEW) + "…"
                      : log.message}
                  </span>
                  {log.message.length > MAX_MESSAGE_PREVIEW && (
                    <button
                      type="button"
                      className="recent-logs-fs__msg-more"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLogIndex(idx);
                      }}
                    >
                      More
                    </button>
                  )}
                </div>
                {log.correlationId && (
                  <span
                    className="recent-logs-fs__corr recent-logs-fs__corr--clickable"
                    title={`Trace: ${log.correlationId}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCorrelationIdClick?.(log.correlationId!);
                    }}
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
            ))
          )}
        </div>
      </BaseModal>

      <BaseModal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLogIndex(null)}
        title="Log Details"
        size="lg"
        className="recent-logs-modal__panel"
        ariaLabel="Log entry details"
      >
        {selectedLog && (
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
                    <div
                      className="recent-logs-modal__value recent-logs-modal__value--mono recent-logs-modal__value--break recent-logs-modal__value--clickable"
                      onClick={() =>
                        onCorrelationIdClick?.(selectedLog.correlationId!)
                      }
                      title="View full trace"
                    >
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

                <div>
                  <div className="recent-logs-modal__data-header">
                    <div className="recent-logs-modal__label">Data</div>
                    <button
                      className="recent-logs-modal__copy"
                      disabled={!selectedLogData.hasData}
                      title={
                        selectedLogData.hasData
                          ? "Copy log data"
                          : "No data to copy"
                      }
                      onClick={() => {
                        if (!selectedLogData.hasData) return;
                        navigator.clipboard
                          .writeText(selectedLogData.raw)
                          .catch(() => {});
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="recent-logs-modal__data">
                    {!selectedLogData.hasData ? (
                      <div className="recent-logs-modal__empty">
                        Data is empty or missing for this log entry.
                      </div>
                    ) : selectedLogData.parsed ? (
                      <JsonViewer data={selectedLogData.parsed} />
                    ) : (
                      <pre className="recent-logs-modal__pre">
                        {selectedLogData.raw}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
};
