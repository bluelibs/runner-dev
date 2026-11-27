import React, { useCallback, useState } from "react";
import {
  useHistoryQuery,
  type HistoryUpdates,
} from "../../hooks/useHistoryQuery";
import { DocIcon } from "../common/DocIcon";
import { loadTracker, type IssueSummary } from "./errorTrackerData";
import { IssueInspector } from "./IssueInspector";
import "./ErrorTracker.scss";

export function ErrorTracker({
  search,
  ...updates
}: HistoryUpdates & {
  search?: { query: string; setQuery: (value: string) => void };
}) {
  const [localFilter, setLocalFilter] = useState("");
  const filter = search?.query ?? localFilter;
  const setFilter = search?.setQuery ?? setLocalFilter;
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<IssueSummary | null>(null);
  const load = useCallback(() => loadTracker(filter), [filter]);
  const { snapshot, failure } = useHistoryQuery(load, updates);
  const groups = snapshot?.errorGroups ?? [];
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  const maxCount = groups.reduce((max, g) => Math.max(max, g.count), 1);
  return (
    <section className="issue-tracker" aria-label="Error tracker">
      <header className="issue-heading">
        <div>
          <h3>Error tracker</h3>
          <p>Failures grouped by source, message and stack frame.</p>
        </div>
        {snapshot?.historyPersisted != null && (
          <span className="issue-storage">
            <DocIcon name="folder" size={14} />
            {snapshot.historyPersisted
              ? "Persistent history"
              : "In-memory history"}
          </span>
        )}
      </header>
      {failure && (
        <p className="issue-notice" role="alert">
          {failure}
        </p>
      )}
      {snapshot ? (
        <>
          <dl className="issue-metrics">
            <div>
              <dt>Distinct issues</dt>
              <dd>{groups.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Occurrences</dt>
              <dd>{total.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Repeat occurrences</dt>
              <dd>{(total - groups.length).toLocaleString()}</dd>
            </div>
          </dl>
          <div className="issue-list-head">
            <h4>Recent issues</h4>
            <input
              type="search"
              aria-label="Filter issues"
              placeholder="Search error history…"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(25);
              }}
            />
          </div>
          {groups.slice(0, limit).map((group) => (
            <button
              className="issue-row"
              key={group.id}
              onClick={() => setSelected(group)}
            >
              <span className="issue-symbol">
                <DocIcon name="error" size={17} />
              </span>
              <span className="issue-name">
                <strong>
                  {group.latest.message || "(empty error message)"}
                </strong>
                <small>
                  {group.latest.sourceKind.toLowerCase()} ·{" "}
                  {group.latest.sourceId}
                </small>
              </span>
              <span className="issue-count">
                {group.count.toLocaleString()}×
                <i>
                  <b style={{ width: `${(100 * group.count) / maxCount}%` }} />
                </i>
              </span>
              <time title={new Date(group.lastSeenMs).toLocaleString()}>
                {new Date(group.lastSeenMs).toLocaleTimeString()}
              </time>
              <DocIcon name="chevron-right" size={14} />
            </button>
          ))}
          {!groups.length && (
            <p className="issue-notice">
              {filter
                ? "No issues match your filter."
                : "No errors in retained history."}
            </p>
          )}
          {groups.length > limit && (
            <button
              className="issue-action"
              onClick={() => setLimit(limit + 25)}
            >
              Show more issues
            </button>
          )}
        </>
      ) : (
        !failure && <p className="issue-notice">Loading error history…</p>
      )}
      {selected && (
        <IssueInspector summary={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
