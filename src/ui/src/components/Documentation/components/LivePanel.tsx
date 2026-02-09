import React, { useState } from "react";
import { RecentLogs } from "./live/RecentLogs";
import { RecentEvents } from "./live/RecentEvents";
import { RecentRuns } from "./live/RecentRuns";
import { TraceView } from "./live/TraceView";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  useLiveStream,
  MIN_POLL_INTERVAL_MS,
  MAX_POLL_INTERVAL_MS,
} from "../hooks/useLiveStream";
import type { ConnectionMode } from "../hooks/useLiveStream";

interface LivePanelProps {
  detailed?: boolean;
  introspector: Introspector;
}

// ---------------------------------------------------------------------------
// Helpers (outside component to avoid per-render re-creation)
// ---------------------------------------------------------------------------

const CONNECTION_BADGES: Record<
  ConnectionMode,
  { label: string; icon: string; className: string }
> = {
  sse: { label: "SSE", icon: "⚡", className: "connection-badge--sse" },
  polling: {
    label: "Polling",
    icon: "🔄",
    className: "connection-badge--polling",
  },
};

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export const LivePanel: React.FC<LivePanelProps> = ({
  detailed = false,
  introspector: _introspector,
}) => {
  const {
    liveData,
    error,
    connectionMode,
    isActive,
    setIsActive,
    pollInterval,
    setPollInterval,
    refresh,
  } = useLiveStream({ detailed });

  const [traceCorrelationId, setTraceCorrelationId] = useState<string | null>(
    null
  );

  const badge = CONNECTION_BADGES[connectionMode];

  if (error) {
    return (
      <div className="live-panel live-panel--error">
        <div className="live-error">
          <span>❌ Error loading live data: {error}</span>
          <button onClick={() => refresh()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!liveData) {
    return (
      <div className="live-panel live-panel--loading">
        <div className="live-loading">📡 Loading live data...</div>
      </div>
    );
  }

  return (
    <div className="live-panel">
      <div className="live-controls">
        <span
          className={`connection-badge ${badge.className}`}
          title={`Connected via ${badge.label}`}
        >
          {badge.icon} {badge.label}
        </span>

        <button
          onClick={() => setIsActive(!isActive)}
          className={`clean-button ${isActive ? "live-toggle--active" : ""}`}
        >
          {isActive ? "⏸ Pause" : "▶ Resume"} Live Updates
        </button>
        <button onClick={() => refresh()} className="clean-button">
          Refresh
        </button>

        {/* Poll interval slider — only shown in polling mode */}
        {connectionMode === "polling" && (
          <div className="poll-interval-control">
            <label
              htmlFor="poll-interval-slider"
              className="poll-interval-label"
            >
              Interval: {(pollInterval / 1000).toFixed(1)}s
            </label>
            <input
              id="poll-interval-slider"
              type="range"
              min={MIN_POLL_INTERVAL_MS}
              max={MAX_POLL_INTERVAL_MS}
              step={100}
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="poll-interval-slider"
            />
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="live-main-grid">
        {/* System Health - Full Width */}
        <div className="live-section live-section--health">
          <h3>System Health</h3>
          <div className="health-metrics">
            <div className="metric">
              <span className="metric-label">Memory</span>
              <span className="metric-value">
                {formatBytes(liveData.memory.heapUsed)} /{" "}
                {formatBytes(liveData.memory.heapTotal)}
              </span>
              <div className="metric-detail">
                RSS: {formatBytes(liveData.memory.rss)}
              </div>
            </div>
            <div className="metric">
              <span className="metric-label">CPU Usage</span>
              <span className="metric-value">
                {(liveData.cpu.usage * 100).toFixed(1)}%
              </span>
              <div className="metric-detail">
                Load: {liveData.cpu.loadAverage.toFixed(2)}
              </div>
            </div>
            <div className="metric">
              <span className="metric-label">Event Loop</span>
              <span className="metric-value">
                {liveData.eventLoop.lag.toFixed(2)}ms
              </span>
              <div className="metric-detail">Lag</div>
            </div>
            <div className="metric">
              <span className="metric-label">GC (30s)</span>
              <span className="metric-value">{liveData.gc.collections}</span>
              <div className="metric-detail">
                {liveData.gc.duration.toFixed(1)}ms total
              </div>
            </div>
          </div>
        </div>

        {/* Logs - Full Width */}
        <div className="live-logs-section">
          <RecentLogs
            logs={liveData.logs}
            onCorrelationIdClick={setTraceCorrelationId}
          />
        </div>

        {/* Recent Events and Runs - stacked */}
        <div className="live-events-runs-grid">
          <div className="live-section">
            <RecentEvents
              emissions={liveData.emissions}
              detailed={detailed}
              onCorrelationIdClick={setTraceCorrelationId}
            />
          </div>

          <div className="live-section">
            <RecentRuns
              runs={liveData.runs}
              errors={liveData.errors}
              detailed={detailed}
              onCorrelationIdClick={setTraceCorrelationId}
            />
          </div>
        </div>
      </div>

      {/* Trace View Modal */}
      {traceCorrelationId && liveData && (
        <TraceView
          correlationId={traceCorrelationId}
          logs={liveData.logs}
          emissions={liveData.emissions}
          errors={liveData.errors}
          runs={liveData.runs}
          onClose={() => setTraceCorrelationId(null)}
        />
      )}
    </div>
  );
};
