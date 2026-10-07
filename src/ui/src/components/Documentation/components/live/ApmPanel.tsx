import React, { useEffect, useState } from "react";
import { graphqlRequest } from "../../utils/graphqlClient";
import type {
  ApmSnapshot,
  ApmScope,
} from "../../../../../../resources/live/apm";
import { ApmFailuresModal } from "./ApmFailuresModal";
import type { FailureSelection } from "./apmFailureDetails";
import "./ApmPanel.scss";

import {
  ApmPerformanceTable,
  formatApmDuration as ms,
  type PerformanceRow,
} from "./ApmPerformanceTable";
type PerformanceSnapshot = Omit<ApmSnapshot, "tasks" | "hooks"> & {
  tasks: PerformanceRow[];
  hooks: PerformanceRow[];
};

const QUERY = `query TaskPerformance($window: Int!, $scope: ApmScope!) {
  live { apm(windowMinutes: $window, scope: $scope) {
    enabled storage maxSamples maxStorage retainedBytes retainedSamples windowMinutes scope oldestTimestampMs cutoffTimestampMs pendingSamples persistenceError
    tasks { nodeId: taskId count failures errorRate meanMs p50Ms p95Ms p99Ms maxMs }
    hooks { nodeId: hookId count failures errorRate meanMs p50Ms p95Ms p99Ms maxMs }
  } }
}`;

export function ApmPanel({
  active,
  pollInterval,
  refreshKey,
}: {
  active: boolean;
  pollInterval: number;
  refreshKey: number;
}) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [scope, setScope] = useState<ApmScope>("all");
  const [kind, setKind] = useState<"tasks" | "hooks">("tasks");
  const [failureSelection, setFailureSelection] =
    useState<FailureSelection | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await graphqlRequest<{
          live: { apm: PerformanceSnapshot | null };
        }>(QUERY, { window: windowMinutes, scope });
        if (!disposed) {
          setSnapshot(data.live.apm);
          setError(null);
        }
      } catch (cause) {
        if (!disposed)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load task performance."
          );
      } finally {
        if (!disposed && active) timer = setTimeout(load, pollInterval);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [windowMinutes, scope, active, pollInterval, refreshKey]);

  if (error)
    return (
      <section className="apm-panel">
        <h3>Task & hook performance</h3>
        <p role="alert">{error}</p>
      </section>
    );
  if (!snapshot)
    return (
      <section className="apm-panel">
        <h3>Task & hook performance</h3>
        <p>Loading performance metrics…</p>
      </section>
    );
  if (!snapshot.enabled)
    return (
      <section className="apm-panel apm-panel--disabled">
        <span className="apm-eyebrow">APM · OPT IN</span>
        <h3>Task & hook performance</h3>
        <p>
          Spot slow tasks, hooks and long tails across executions. Enable
          collection with <code>dev.with({"{ apm: true }"})</code>.
        </p>
        <small>
          SQLite when available · bounded memory fallback · no task payloads
        </small>
      </section>
    );
  const entries = snapshot[kind];
  const label = kind === "tasks" ? "task" : "hook";
  const tasks = entries.filter((task) =>
    task.nodeId.toLowerCase().includes(search.toLowerCase())
  );
  const count = entries.reduce((total, task) => total + task.count, 0);
  const failures = entries.reduce((total, task) => total + task.failures, 0);
  const slowest = entries[0];
  return (
    <section className="apm-panel" aria-label="Task and hook performance">
      <div className="apm-heading">
        <div>
          <span className="apm-eyebrow">APM · TASKS & REACTIONS</span>
          <h3>Task & hook performance</h3>
          <p>Find the long tail. Every completed call counts.</p>
        </div>
        <span className="apm-storage">
          <i />
          {snapshot.storage === "sqlite"
            ? "SQLite · persisted"
            : ["sqlite", "clickhouse", "redis"].includes(snapshot.storage)
            ? "ClickHouse · archive"
            : snapshot.storage === "memory"
            ? "Memory · this session"
            : `${snapshot.storage} · archive`}
        </span>
      </div>
      {snapshot.persistenceError && (
        <p role="alert" className="apm-empty">
          Archive writes failed: {snapshot.persistenceError}
        </p>
      )}
      <div className="apm-toolbar apm-kind-toolbar">
        <div className="apm-scopes" role="group" aria-label="Execution kind">
          {(["tasks", "hooks"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setSearch("");
              }}
            >
              {value === "tasks" ? "Tasks" : "Hooks"} ·{" "}
              {snapshot[value]
                .reduce((sum, entry) => sum + entry.count, 0)
                .toLocaleString()}
            </button>
          ))}
        </div>
      </div>
      <div className="apm-toolbar">
        <div className="apm-scopes" role="group" aria-label="Call scope">
          {(["all", "direct", "nested"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {value === "all"
                ? "All calls"
                : value === "direct"
                ? "Direct calls"
                : "Nested calls"}
            </button>
          ))}
        </div>
        <label>
          Window{" "}
          <select
            value={windowMinutes}
            onChange={(event) => setWindowMinutes(Number(event.target.value))}
          >
            <option value={5}>Last 5 minutes</option>
            <option value={30}>Last 30 minutes</option>
            <option value={60}>Last hour</option>
            <option value={1440}>Last 24 hours</option>
            <option value={10080}>Last 7 days</option>
            <option value={43200}>Last 30 days</option>
          </select>
        </label>
      </div>
      <div className="apm-summary">
        <div>
          <span>Completed calls</span>
          <strong>{count.toLocaleString()}</strong>
          <small>
            {entries.length} active {kind}
          </small>
        </div>
        <div>
          <span>Failure rate</span>
          <strong className={failures ? "apm-warning" : ""}>
            {count ? ((failures / count) * 100).toFixed(1) : "0.0"}%
          </strong>
          <small>{failures.toLocaleString()} failed calls</small>
        </div>
        <div>
          <span>Highest {label} p95</span>
          <strong>{slowest ? ms(slowest.p95Ms) : "—"}</strong>
          <small title={slowest?.nodeId}>
            {slowest?.nodeId ?? "Waiting for calls"}
          </small>
        </div>
      </div>
      <div className="apm-table-heading">
        <h4>
          Latency by {label} <span>Sorted by p95</span>
        </h4>
        <input
          aria-label={`Filter performance ${kind}`}
          placeholder={`Filter ${kind}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <ApmPerformanceTable
        entries={tasks}
        kind={kind}
        highestP95={slowest?.p95Ms ?? 0}
        onFailure={(nodeId) =>
          setFailureSelection({
            nodeId,
            nodeKind: kind === "tasks" ? "TASK" : "HOOK",
            windowMinutes,
            scope,
            endTimestampMs: Date.now(),
          })
        }
      />
      {!tasks.length && (
        <p className="apm-empty">
          {count
            ? `No ${kind} match your filter.`
            : `No completed ${label} calls in this window yet.`}
        </p>
      )}
      <footer>
        <span>Inclusive duration · includes delegated work · {kind} only</span>
        <span>
          {snapshot.maxStorage
            ? `${((snapshot.retainedBytes ?? 0) / 1024).toFixed(0)} / ${(
                snapshot.maxStorage / 1024
              ).toFixed(
                0
              )} KB · ${snapshot.retainedSamples.toLocaleString()} samples`
            : `${snapshot.retainedSamples.toLocaleString()} / ${snapshot.maxSamples.toLocaleString()} samples retained`}
        </span>
      </footer>
      <p className="apm-method">
        Exact nearest-rank percentiles over retained completions in the selected
        window. Direct = no parent task, hook or event; nested = called within
        one. Task and hook durations overlap; counts are shown separately.{" "}
        {snapshot.oldestTimestampMs !== null &&
          `History starts ${new Date(
            snapshot.oldestTimestampMs
          ).toLocaleString()}.`}
      </p>
      {["sqlite", "clickhouse", "redis"].includes(snapshot.storage) && (
        <p className="apm-empty">
          Retention limits apply to the dashboard and stored sample data.{" "}
          {snapshot.pendingSamples ?? 0} samples awaiting confirmation.
        </p>
      )}
      {failureSelection && (
        <ApmFailuresModal
          selection={failureSelection}
          onClose={() => setFailureSelection(null)}
        />
      )}
    </section>
  );
}
