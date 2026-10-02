import React, { useState } from "react";
import type { Introspector } from "../../../../../resources/models/Introspector";
import { useLiveStream } from "../hooks/useLiveStream";
import { RecentLogs } from "./live/RecentLogs";
import { TraceView } from "./live/TraceView";
import { DocIcon } from "./common/DocIcon";

export function LogsPanel({ introspector }: { introspector: Introspector }) {
  const { liveData, error, isActive, setIsActive, refresh } = useLiveStream({
    detailed: true,
  });
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  return (
    <div className="live-panel">
      <div className="live-header">
        <h2>
          <DocIcon name="list" size={18} className="doc-icon--accent" /> Logs
        </h2>
        <div className="live-controls">
          <button
            className="clean-button"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? "⏸ Pause" : "▶ Resume"} Live Updates
          </button>
          <button className="clean-button" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>
      {error ? (
        <div className="live-error" role="alert">
          Error loading logs: {error}
          <button onClick={refresh}>Retry</button>
        </div>
      ) : !liveData ? (
        <div className="live-loading">Loading logs…</div>
      ) : (
        <RecentLogs
          introspector={introspector}
          logs={liveData.logs}
          onCorrelationIdClick={setCorrelationId}
        />
      )}
      {correlationId && liveData && (
        <TraceView
          correlationId={correlationId}
          logs={liveData.logs}
          emissions={liveData.emissions}
          errors={liveData.errors}
          runs={liveData.runs}
          onClose={() => setCorrelationId(null)}
        />
      )}
    </div>
  );
}
