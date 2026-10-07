import React from "react";
import type { PerformanceMetrics } from "../../../../../../resources/live/apm";
export type PerformanceRow = PerformanceMetrics & { nodeId: string };
export const formatApmDuration = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(2)} ms`;
export function ApmPerformanceTable({
  entries,
  kind,
  highestP95,
  onFailure,
}: {
  entries: PerformanceRow[];
  kind: "tasks" | "hooks";
  highestP95: number;
  onFailure: (nodeId: string) => void;
}) {
  const ms = formatApmDuration;
  return (
    <div className="apm-table-scroll">
      <table>
        <thead>
          <tr>
            <th>{kind === "tasks" ? "Task" : "Hook"}</th>
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
          {entries.map((task) => (
            <tr key={task.nodeId}>
              <td>
                <a href={`#element-${task.nodeId}`}>{task.nodeId}</a>
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
                {task.failures ? (
                  <button
                    className="apm-failure-link"
                    aria-label={`View failures for ${task.nodeId}`}
                    onClick={() => onFailure(task.nodeId)}
                  >
                    {(task.errorRate * 100).toFixed(1)}%
                  </button>
                ) : (
                  "0.0%"
                )}
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
                        highestP95 ? (task.p95Ms / highestP95) * 100 : 0
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
  );
}
