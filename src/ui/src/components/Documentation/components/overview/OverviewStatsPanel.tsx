import React, { useMemo } from "react";
import { useMetrics } from "../../hooks/useMetrics";
import "./OverviewStatsPanel.scss";

export interface OverviewStatsPanelProps {
  onClose: () => void;
}

export const OverviewStatsPanel: React.FC<OverviewStatsPanelProps> = ({
  onClose,
}) => {
  const { throughput, latency, errorByTask, heatmap, isLoading } = useMetrics();

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
  return (
    <div
      className="overview-stats-panel"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="overview-stats-panel__content"
        style={{
          width: "min(1100px, 92vw)",
          maxHeight: "86vh",
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="overview-stats-panel__header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, color: "#1f2937", fontSize: 18, fontWeight: 600 }}>Performance Stats</h3>
          <button
            onClick={onClose}
            style={{
              appearance: "none",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#f9fafb",
              color: "#374151",
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
          >
            Close
          </button>
        </div>

        <div
          className="overview-stats-panel__grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
            marginTop: 16,
          }}
        >
          <section
            className="overview-stats-panel__section"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 20,
              background: "rgba(249,250,251,0.5)",
            }}
          >
            <h4 style={{ marginTop: 0, color: "#374151", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Throughput over time</h4>
            <div
              style={{
                height: 180,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {isLoading ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>Loading…</div>
              ) : (
                <svg width={"100%"} height={160} viewBox={`0 0 800 160`}>
                  <defs>
                    <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
                      <stop
                        offset="100%"
                        stopColor="#60a5fa"
                        stopOpacity="0.1"
                      />
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
          <section
            className="overview-stats-panel__section"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 20,
              background: "rgba(249,250,251,0.5)",
            }}
          >
            <h4 style={{ marginTop: 0, color: "#374151", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Latency percentiles</h4>
            <div
              style={{
                height: 180,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {isLoading ? (
                <div style={{ color: "#6b7280", fontSize: 12 }}>Loading…</div>
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
          <section
            className="overview-stats-panel__section"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 20,
              background: "rgba(249,250,251,0.5)",
            }}
          >
            <h4 style={{ marginTop: 0, color: "#374151", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Error rate</h4>
            <div
              style={{
                height: 180,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8,
                padding: 12,
                color: "#374151",
                fontSize: 12,
              }}
            >
              {isLoading ? (
                <div style={{ color: "#6b7280" }}>Loading…</div>
              ) : errorByTask.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No errors</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {errorByTask.map((e) => (
                    <li key={e.taskId}>
                      {e.taskId} — {e.errors}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section
            className="overview-stats-panel__section"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: 20,
              background: "rgba(249,250,251,0.5)",
            }}
          >
            <h4 style={{ marginTop: 0, color: "#374151", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Activity heatmap</h4>
            <div
              style={{
                height: 180,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {!isLoading && (
                <svg width={"100%"} height={160} viewBox={`0 0 800 160`}>
                  {heatmap.map((row, y) =>
                    row.map((v, x) => {
                      const cx = (x / 24) * 800;
                      const cy = (y / 7) * 160;
                      const intensity = Math.min(1, v / 10);
                      const color = `rgba(99,102,241,${
                        0.15 + intensity * 0.75
                      })`;
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
      </div>
    </div>
  );
};
