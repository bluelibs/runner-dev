import React, { useEffect, useState } from "react";
import { BaseModal } from "../modals";
import { DocIcon } from "../common/DocIcon";
import { copyToClipboard } from "../chat/ChatUtils";
import {
  loadIssue,
  investigationPrompt,
  type IssueSummary,
} from "./errorTrackerData";
import { loadRetainedTrace, type RetainedTrace } from "./apmFailureDetails";
import type { ErrorEntry } from "../../hooks/liveTelemetry.types";
import { downloadTelemetry } from "./telemetryExport";
import { TelemetryExportButton } from "./TelemetryExportButton";
import { TraceView } from "./TraceView";
import "./IssueInspector.scss";

export function IssueInspector({
  summary,
  onClose,
}: {
  summary: IssueSummary;
  onClose: () => void;
}) {
  const [issue, setIssue] = useState<Awaited<
    ReturnType<typeof loadIssue>
  > | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    loadIssue(summary.id, 50)
      .then((value) => {
        if (active) setIssue(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load issue."
          );
      });
    return () => {
      active = false;
    };
  }, [summary.id, attempt]);
  const group = issue ?? summary;
  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Issue details"
      subtitle={group.latest.sourceId}
      className="issue-inspector"
    >
      <div className="issue-body">
        <h3>{group.latest.message || "(empty error message)"}</h3>
        <dl className="issue-facts">
          <div>
            <dt>Occurrences</dt>
            <dd>{group.count.toLocaleString()}</dd>
          </div>
          <div>
            <dt>First seen</dt>
            <dd>{new Date(group.firstSeenMs).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{new Date(group.lastSeenMs).toLocaleString()}</dd>
          </div>
        </dl>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </p>
        ) : !issue ? (
          <p>Loading occurrences…</p>
        ) : (
          <>
            <label className="occurrence-picker">
              Occurrence {issue.count > 50 && "(latest 50)"}
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              >
                {issue.occurrences.map((record, i) => (
                  <option key={record.sequence} value={i}>
                    #{issue.count - i} ·{" "}
                    {new Date(record.timestampMs).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <OccurrenceEvidence
              key={issue.occurrences[index].sequence}
              issue={issue}
              entry={issue.occurrences[index]}
            />
          </>
        )}
      </div>
    </BaseModal>
  );
}

function OccurrenceEvidence({
  issue,
  entry,
}: {
  issue: Awaited<ReturnType<typeof loadIssue>>;
  entry: ErrorEntry;
}) {
  const [trace, setTrace] = useState<RetainedTrace | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showTrace, setShowTrace] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    if (entry.correlationId)
      loadRetainedTrace(entry.correlationId)
        .then((result) => {
          if (active) setTrace(result);
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load correlated logs."
            );
        });
    return () => {
      active = false;
    };
  }, [entry.correlationId, attempt]);
  const loading = Boolean(entry.correlationId && !trace && !error);
  const prompt = investigationPrompt(issue, entry, trace);
  return (
    <>
      <section>
        {entry.message !== issue.latest.message && <p>{entry.message}</p>}
        <h4>Stack trace</h4>
        <pre>{entry.stack || "No stack was captured for this occurrence."}</pre>
      </section>
      {entry.data && (
        <details>
          <summary>Recorded data</summary>
          <pre>{entry.data}</pre>
        </details>
      )}
      <section>
        <div className="issue-section-head">
          <h4>Correlated logs</h4>
          {trace && (
            <button className="issue-action" onClick={() => setShowTrace(true)}>
              Open trace →
            </button>
          )}
        </div>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </p>
        ) : loading ? (
          <p>Loading logs…</p>
        ) : trace?.logs.length ? (
          <ul className="issue-logs">
            {trace.logs.slice(-5).map((log) => (
              <li key={log.sequence}>
                <time>{new Date(log.timestampMs).toLocaleTimeString()}</time>
                <b>{log.level}</b>
                <span>{log.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {entry.correlationId
              ? "No retained logs for this correlation ID."
              : "This occurrence has no correlation ID."}
          </p>
        )}
      </section>
      <div className="issue-actions">
        <button
          className="issue-action issue-action--primary"
          disabled={loading}
          onClick={async () => {
            const ok = await copyToClipboard(prompt);
            setCopyState(
              ok ? "Prompt copied" : "Select and copy the prompt below."
            );
            if (!ok) setShowPrompt(true);
          }}
        >
          <DocIcon name="copy" size={14} /> Copy agent prompt
        </button>
        <button
          className="issue-action"
          aria-expanded={showPrompt}
          onClick={() => setShowPrompt(!showPrompt)}
        >
          {showPrompt ? "Hide prompt" : "Preview prompt"}
        </button>
        <TelemetryExportButton
          label="Export issue JSON"
          disabled={loading}
          onExport={async () => {
            const group =
              issue.count === issue.occurrences.length
                ? issue
                : await loadIssue(issue.id);
            downloadTelemetry("error-group", {
              group,
              selectedOccurrence: entry,
              trace,
              traceError: error || null,
            });
          }}
        />
        <span role="status">{copyState}</span>
      </div>
      {showPrompt && (
        <textarea
          aria-label="Agent prompt"
          className="issue-prompt"
          readOnly
          value={prompt}
        />
      )}
      {showTrace && trace && entry.correlationId && (
        <TraceView
          {...trace}
          correlationId={entry.correlationId}
          onClose={() => setShowTrace(false)}
        />
      )}
    </>
  );
}
