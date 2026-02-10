import React, { useMemo, useEffect } from "react";
import { useMetrics } from "../../hooks/useMetrics";
import { BaseModal } from "../modals";
import "./OverviewStatsPanel.scss";

export interface OverviewStatsPanelProps {
  onClose: () => void;
  overlay?: boolean;
}

export const OverviewStatsPanel: React.FC<OverviewStatsPanelProps> = ({
  onClose,
  overlay = false,
}) => {
  const { throughput, latency, errorByTask, heatmap, isLoading } = useMetrics();

  // Escape key handling delegated to BaseModal when overlay=true.
  // For inline mode, we still handle Escape ourselves.
  useEffect(() => {
    if (overlay) return; // BaseModal handles Escape for overlay mode
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, overlay]);

  const tpPath = useMemo(() => {
    if (throughput.length === 0) return "";
    const w = 800;
    const h = 160;
    const max = Math.max(
      1,
      ...throughput.map((p) => p.success + p.error + p.canceled)
    );
    const toX = (i: number) => (i / Math.max(1, throughput.length - 1)) * w;
    const toY = (v: number) => h - (v / max) * h;
    const pts = throughput.map(
      (p, i) => `${toX(i)},${toY(p.success + p.error)}`
    );
    return `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
  }, [throughput]);

  const latencyPaths = useMemo(() => {
    if (latency.length === 0) return { p50: "", p95: "", p99: "" };
    const w = 800;
    const h = 160;
    const max = Math.max(1, ...latency.flatMap((p) => [p.p50, p.p95, p.p99]));
    const toX = (i: number) => (i / Math.max(1, latency.length - 1)) * w;
    const toY = (v: number) => h - (v / max) * h;
    const mk = (sel: (p: (typeof latency)[number]) => number) =>
      latency
        .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(sel(p))}`)
        .join(" ");
    return {
      p50: mk((p) => p.p50),
      p95: mk((p) => p.p95),
      p99: mk((p) => p.p99),
    };
  }, [latency]);
  const inner = (
    <>
      {/* Only render the inline header when NOT in overlay mode.
          In overlay mode, BaseModal provides the header. */}
      {!overlay && (
        <div className="overview-stats-panel__header">
          <h3>Performance Stats</h3>
          <button onClick={onClose} className="clear-button">
            Close
          </button>
        </div>
      )}

      <div className="overview-stats-panel__grid">
        <section className="overview-stats-panel__section">
          <h4>Throughput over time</h4>
          <div className="overview-stats-panel__chart">
            {isLoading ? (
              <div className="overview-stats-panel__loading">Loading…</div>
            ) : (
              <svg width={"100%"} height={160} viewBox={`0 0 800 160`}>
                <defs>
                  <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path
                  d={tpPath}
                  fill="url(#tp)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                />
              </svg>
            )}
          </div>
        </section>
        <section className="overview-stats-panel__section">
          <h4>Latency percentiles</h4>
          <div className="overview-stats-panel__chart">
            {isLoading ? (
              <div className="overview-stats-panel__loading">Loading…</div>
            ) : (
              <svg width={"100%"} height={160} viewBox={`0 0 800 160`}>
                <path
                  d={latencyPaths.p50}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
                <path
                  d={latencyPaths.p95}
                  fill="none"
                  stroke="#eab308"
                  strokeWidth={2}
                />
                <path
                  d={latencyPaths.p99}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
              </svg>
            )}
          </div>
        </section>
        <section className="overview-stats-panel__section">
          <h4>Error rate</h4>
          <div className="overview-stats-panel__list">
            {isLoading ? (
              <div className="overview-stats-panel__loading">Loading…</div>
            ) : errorByTask.length === 0 ? (
              <div className="overview-stats-panel__empty">No errors</div>
            ) : (
              <ul>
                {errorByTask.map((e) => (
                  <li key={e.taskId}>
                    {e.taskId} — {e.errors}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="overview-stats-panel__section">
          <h4>Activity heatmap</h4>
          <div className="overview-stats-panel__chart">
            {!isLoading && (
              <svg width={"100%"} height={160} viewBox={`0 0 800 160`}>
                {heatmap.map((row, y) =>
                  row.map((v, x) => {
                    const cx = (x / 24) * 800;
                    const cy = (y / 7) * 160;
                    const intensity = Math.min(1, v / 10);
                    const color = `rgba(99,102,241,${0.15 + intensity * 0.75})`;
                    return (
                      <rect
                        key={`${x}-${y}`}
                        x={cx}
                        y={cy}
                        width={800 / 24 - 1}
                        height={160 / 7 - 1}
                        fill={color}
                      />
                    );
                  })
                )}
              </svg>
            )}
          </div>
        </section>
      </div>
    </>
  );

  if (overlay) {
    return (
      <BaseModal
        isOpen
        onClose={onClose}
        title="Performance Stats"
        size="xl"
        className="overview-stats-panel__content"
        ariaLabel="Performance stats overlay"
      >
        {inner}
      </BaseModal>
    );
  }

  return (
    <div className="overview-stats-panel overview-stats-panel--inline">
      <div
        role="region"
        aria-label="Performance stats"
        className="overview-stats-panel__content"
      >
        {inner}
      </div>
    </div>
  );
};
