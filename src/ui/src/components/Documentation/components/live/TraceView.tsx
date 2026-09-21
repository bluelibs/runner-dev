import React, { useMemo } from "react";
import JsonViewer from "../JsonViewer";
import type {
  LogEntry,
  EmissionEntry,
  ErrorEntry,
  RunRecord,
} from "../../hooks/useLiveStream";
import { BaseModal } from "../modals";
import { DocIcon } from "../common/DocIcon";
import "./TraceView.scss";

// ─── Unified timeline entry ──────────────────────────────────────────────────

type TraceEntryKind = "log" | "emission" | "error" | "run";

interface TraceEntry {
  kind: TraceEntryKind;
  timestampMs: number;
  /** Human-readable summary line */
  summary: string;
  /** Extra detail for the expanded view */
  detail?: Record<string, unknown>;
  /** Link target id (e.g. element-${sourceId}) */
  sourceId?: string;
  /** Raw entry for kind-specific rendering */
  raw: LogEntry | EmissionEntry | ErrorEntry | RunRecord;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TraceViewProps {
  correlationId: string;
  logs: LogEntry[];
  emissions: EmissionEntry[];
  errors: ErrorEntry[];
  runs: RunRecord[];
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<TraceEntryKind, string> = {
  log: "LOG",
  emission: "EVENT",
  error: "ERROR",
  run: "RUN",
};

const KIND_ICONS: Record<TraceEntryKind, string> = {
  log: "file",
  emission: "event",
  error: "error",
  run: "task",
};

const formatTimestamp = (ms: number): string => {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}.${String(
    d.getMilliseconds()
  ).padStart(3, "0")}`;
};

const shortTime = (ms: number): string => {
  const d = new Date(ms);
  return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(
    3,
    "0"
  )}`;
};

const tryParseJson = (raw: string): object | null => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
};

/** Build a unified, chronologically-sorted timeline from all entry arrays. */
function buildTimeline(
  correlationId: string,
  logs: LogEntry[],
  emissions: EmissionEntry[],
  errors: ErrorEntry[],
  runs: RunRecord[]
): TraceEntry[] {
  const entries: TraceEntry[] = [];

  for (const log of logs) {
    if (log.correlationId !== correlationId) continue;
    entries.push({
      kind: "log",
      timestampMs: log.timestampMs,
      summary: `[${log.level.toUpperCase()}] ${log.message}`,
      sourceId: log.sourceId ?? undefined,
      detail: log.data ? { data: log.data } : undefined,
      raw: log,
    });
  }

  for (const emission of emissions) {
    if (emission.correlationId !== correlationId) continue;
    entries.push({
      kind: "emission",
      timestampMs: emission.timestampMs,
      summary: `Emitted ${emission.eventId}${
        emission.emitterId ? ` (from ${emission.emitterId})` : ""
      }`,
      sourceId: emission.eventId,
      detail: emission.payload ? { payload: emission.payload } : undefined,
      raw: emission,
    });
  }

  for (const error of errors) {
    if (error.correlationId !== correlationId) continue;
    entries.push({
      kind: "error",
      timestampMs: error.timestampMs,
      summary: `${error.sourceKind}:${error.sourceId} — ${error.message}`,
      sourceId: error.sourceId,
      detail: {
        ...(error.stack ? { stack: error.stack } : {}),
        ...(error.data ? { data: error.data } : {}),
      },
      raw: error,
    });
  }

  for (const run of runs) {
    if (run.correlationId !== correlationId) continue;
    const status = run.ok ? "OK" : "FAIL";
    const duration =
      run.durationMs != null ? ` (${run.durationMs.toFixed(1)}ms)` : "";
    entries.push({
      kind: "run",
      timestampMs: run.timestampMs,
      summary: `${status} ${run.nodeKind}:${run.nodeId}${duration}`,
      sourceId: run.nodeId,
      detail: run.error ? { error: run.error } : undefined,
      raw: run,
    });
  }

  // Sort chronologically (oldest first)
  entries.sort((a, b) => a.timestampMs - b.timestampMs);

  return entries;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TraceView: React.FC<TraceViewProps> = ({
  correlationId,
  logs,
  emissions,
  errors,
  runs,
  onClose,
}) => {
  const timeline = useMemo(
    () => buildTimeline(correlationId, logs, emissions, errors, runs),
    [correlationId, logs, emissions, errors, runs]
  );

  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  // Compute overall time span for the timeline gutter
  const timeSpan = useMemo(() => {
    if (timeline.length === 0) return { startMs: 0, durationMs: 1 };
    const startMs = timeline[0].timestampMs;
    const endMs = timeline[timeline.length - 1].timestampMs;
    return { startMs, durationMs: Math.max(endMs - startMs, 1) };
  }, [timeline]);

  // Summary stats
  const stats = useMemo(() => {
    const counts: Record<TraceEntryKind, number> = {
      log: 0,
      emission: 0,
      error: 0,
      run: 0,
    };
    for (const entry of timeline) counts[entry.kind]++;
    return counts;
  }, [timeline]);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Trace View"
      subtitle={correlationId}
      size="xl"
      className="trace-view__panel"
      ariaLabel={`Trace view for ${correlationId}`}
    >
      {/* Stats bar */}
      <div className="trace-view__stats">
        {(Object.keys(stats) as TraceEntryKind[]).map((kind) => (
          <span
            key={kind}
            className={`trace-view__stat trace-view__stat--${kind}`}
          >
            <DocIcon name={KIND_ICONS[kind]} size={13} /> {stats[kind]}{" "}
            {KIND_LABELS[kind]}
            {stats[kind] !== 1 ? "S" : ""}
          </span>
        ))}
        <span className="trace-view__stat trace-view__stat--total">
          {timeline.length} total
        </span>
      </div>

      {/* Timeline */}
      {timeline.length === 0 ? (
        <div className="trace-view__empty">
          No entries found for this correlation ID.
        </div>
      ) : (
        <div className="trace-view__timeline">
          {timeline.map((entry, idx) => {
            const relativeMs = entry.timestampMs - timeSpan.startMs;
            const isExpanded = expandedIndex === idx;
            const hasDetail =
              entry.detail && Object.keys(entry.detail).length > 0;

            return (
              <div
                key={idx}
                className={`trace-view__entry trace-view__entry--${
                  entry.kind
                } ${isExpanded ? "trace-view__entry--expanded" : ""}`}
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : hasDetail ? idx : null)
                }
              >
                {/* Timeline gutter */}
                <div className="trace-view__gutter">
                  <div className="trace-view__dot" />
                  {idx < timeline.length - 1 && (
                    <div className="trace-view__connector" />
                  )}
                </div>

                {/* Content */}
                <div className="trace-view__content">
                  <div className="trace-view__row">
                    <span className="trace-view__time">
                      {shortTime(entry.timestampMs)}
                    </span>
                    <span
                      className={`trace-view__badge trace-view__badge--${entry.kind}`}
                    >
                      <DocIcon name={KIND_ICONS[entry.kind]} size={13} />{" "}
                      {KIND_LABELS[entry.kind]}
                    </span>
                    <span className="trace-view__summary">{entry.summary}</span>
                    {relativeMs > 0 && (
                      <span className="trace-view__offset">
                        +{relativeMs.toFixed(0)}ms
                      </span>
                    )}
                    {entry.sourceId && (
                      <a
                        href={`#element-${entry.sourceId}`}
                        className="trace-view__link"
                        onClick={(e) => e.stopPropagation()}
                        title={`Go to ${entry.sourceId}`}
                      >
                        →
                      </a>
                    )}
                    {hasDetail && (
                      <button
                        type="button"
                        className="trace-view__expand-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedIndex(isExpanded ? null : idx);
                        }}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && hasDetail && (
                    <div
                      className="trace-view__detail"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Object.entries(entry.detail!).map(([key, value]) => (
                        <div key={key} className="trace-view__detail-section">
                          <div className="trace-view__detail-label">{key}</div>
                          <div className="trace-view__detail-value">
                            {renderDetailValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Time span footer */}
      {timeline.length >= 2 && (
        <div className="trace-view__footer">
          <span>
            {formatTimestamp(timeSpan.startMs)} →{" "}
            {formatTimestamp(timeSpan.startMs + timeSpan.durationMs)}
          </span>
          <span className="trace-view__duration">
            Total span: {timeSpan.durationMs.toFixed(0)}ms
          </span>
        </div>
      )}
    </BaseModal>
  );
};

/** Render a detail value — try to parse JSON for rich display, otherwise show raw. */
function renderDetailValue(value: unknown): React.ReactNode {
  if (value == null) return <span className="trace-view__null">null</span>;

  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed) return <JsonViewer data={parsed} />;
    // Multi-line strings (e.g. stack traces) get a <pre>
    if (value.includes("\n"))
      return <pre className="trace-view__pre">{value}</pre>;
    return <span>{value}</span>;
  }

  if (typeof value === "object") {
    return <JsonViewer data={value as Record<string, unknown>} />;
  }

  return <span>{String(value)}</span>;
}
