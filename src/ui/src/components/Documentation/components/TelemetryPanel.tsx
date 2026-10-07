import React, { useState } from "react";
import { ApmPanel } from "./live/ApmPanel";
import { DocIcon } from "./common/DocIcon";
import { DEFAULT_POLL_INTERVAL_MS } from "../hooks/useLiveStream";

export function TelemetryPanel() {
  const [active, setActive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="live-panel">
      <div className="live-header">
        <h2>
          <DocIcon name="chart" size={18} className="doc-icon--accent" />{" "}
          Telemetry
        </h2>
        <div className="live-controls">
          <button className="clean-button" onClick={() => setActive(!active)}>
            {active ? "⏸ Pause" : "▶ Resume"} Updates
          </button>
          <button
            className="clean-button"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Refresh
          </button>
        </div>
      </div>
      <ApmPanel
        active={active}
        pollInterval={DEFAULT_POLL_INTERVAL_MS}
        refreshKey={refreshKey}
      />
    </div>
  );
}
