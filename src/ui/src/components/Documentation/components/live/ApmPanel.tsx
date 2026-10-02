import React, { useEffect, useState } from "react";
import { graphqlRequest } from "../../utils/graphqlClient";
import type {
  ApmSnapshot,
  ApmScope,
} from "../../../../../../resources/live/apm";
import "./ApmPanel.scss";

const QUERY = `query TaskPerformance($window: Int!, $scope: ApmScope!) {
  live { apm(windowMinutes: $window, scope: $scope) {
    enabled storage maxSamples retainedSamples windowMinutes scope oldestTimestampMs
    tasks { taskId count failures errorRate meanMs p50Ms p95Ms p99Ms maxMs }
  } }
}`;
const ms = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(2)} ms`;

export function ApmPanel({
  active,
  pollInterval,
  refreshKey,
}: {
  active: boolean;
  pollInterval: number;
  refreshKey: number;
}) {
  const [snapshot, setSnapshot] = useState<ApmSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [scope, setScope] = useState<ApmScope>("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await graphqlRequest<{
          live: { apm: ApmSnapshot | null };
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
        <h3>Task performance</h3>
        <p role="alert">{error}</p>
      </section>
    );
  if (!snapshot)
    return (
      <section className="apm-panel">
        <h3>Task performance</h3>
        <p>Loading performance metrics…</p>
      </section>
    );
  if (!snapshot.enabled)
    return (
      <section className="apm-panel apm-panel--disabled">
        <span className="apm-eyebrow">APM · OPT IN</span>
        <h3>Task performance</h3>
        <p>
          Spot slow tasks and long tails across executions. Enable collection
          with <code>dev.with({"{ apm: true }"})</code>.
        </p>
        <small>
          SQLite when available · bounded memory fallback · no task payloads
        </small>
      </section>
    );
  const tasks = snapshot.tasks.filter((task) =>
    task.taskId.toLowerCase().includes(search.toLowerCase())
  );
  const count = snapshot.tasks.reduce((total, task) => total + task.count, 0);
  const failures = snapshot.tasks.reduce(
    (total, task) => total + task.failures,
    0
  );
  const slowest = snapshot.tasks[0];
  return (
    <section className="apm-panel" aria-label="Task performance">
      <div className="apm-heading">
        <div>
          <span className="apm-eyebrow">APM · TASK LATENCY</span>
          <h3>Task performance</h3>
          <p>Find the long tail. Every completed call counts.</p>
        </div>
        <span className="apm-storage">
          <i />
          {snapshot.storage === "sqlite"
            ? "SQLite · persisted"
            : "Memory · this session"}
        </span>
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
          </select>
        </label>
      </div>
      <div className="apm-summary">
        <div>
          <span>Completed calls</span>
          <strong>{count.toLocaleString()}</strong>
          <small>{snapshot.tasks.length} active tasks</small>
        </div>
        <div>
          <span>Failure rate</span>
          <strong className={failures ? "apm-warning" : ""}>
            {count ? ((failures / count) * 100).toFixed(1) : "0.0"}%
          </strong>
          <small>{failures.toLocaleString()} failed calls</small>
        </div>
        <div>
          <span>Highest task p95</span>
          <strong>{slowest ? ms(slowest.p95Ms) : "—"}</strong>
          <small title={slowest?.taskId}>
            {slowest?.taskId ?? "Waiting for calls"}
          </small>
        </div>
      </div>
      <div className="apm-table-heading">
        <h4>
          Latency by task <span>Sorted by p95</span>
        </h4>
        <input
          aria-label="Filter performance tasks"
          placeholder="Filter tasks…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="apm-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Calls</th>
              <th>Failed</th>
              <th>Mean</th>
              <th>p50</th>
              <th>p95</th>
              <th>p99</th>
              <th>Max</th>
              <th aria-label="Relative p95">Tail</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.taskId}>
                <td>
                  <a href={`#element-${task.taskId}`}>{task.taskId}</a>
                  {task.count < 100 && (
                    <small className="apm-sample-note">
                      Small sample · {task.count} calls
                    </small>
                  )}
                </td>
                <td data-label="Calls">{task.count.toLocaleString()}</td>
                <td
                  data-label="Failed"
                  className={task.failures ? "apm-warning" : ""}
                >
                  {(task.errorRate * 100).toFixed(1)}%
                </td>
                <td data-label="Mean">{ms(task.meanMs)}</td>
                <td data-label="p50">{ms(task.p50Ms)}</td>
                <td data-label="p95" className="apm-p95">
                  {ms(task.p95Ms)}
                </td>
                <td data-label="p99">{ms(task.p99Ms)}</td>
                <td data-label="Max">{ms(task.maxMs)}</td>
                <td>
                  <div className="apm-tail">
                    <span
                      style={{
                        width: `${
                          slowest?.p95Ms
                            ? (task.p95Ms / slowest.p95Ms) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!tasks.length && (
        <p className="apm-empty">
          {count
            ? "No tasks match your filter."
            : "No completed task calls in this window yet."}
        </p>
      )}
      <footer>
        <span>Inclusive duration · includes child work · hooks excluded</span>
        <span>
          {snapshot.retainedSamples.toLocaleString()} /{" "}
          {snapshot.maxSamples.toLocaleString()} samples retained
        </span>
      </footer>
      <p className="apm-method">
        Exact nearest-rank percentiles over retained completions in the selected
        window. Direct = no parent task or event; nested = called within a task
        or event. Durations overlap across nested calls.{" "}
        {snapshot.oldestTimestampMs !== null &&
          `History starts ${new Date(
            snapshot.oldestTimestampMs
          ).toLocaleString()}.`}
      </p>
    </section>
  );
}
