import React, { useState } from "react";
import { ApmPanel } from "./live/ApmPanel";
import { DocIcon } from "./common/DocIcon";
import { DEFAULT_POLL_INTERVAL_MS } from "../hooks/useLiveStream";

import { ErrorTracker } from "./live/ErrorTracker";
import { exportHistory } from "./live/telemetryExport";
import { TelemetryExportButton } from "./live/TelemetryExportButton";

export function TelemetryPanel() {
  const [active, setActive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<"performance" | "errors">("performance");
  return (
    <div className="live-panel">
      <div className="live-header">
        <h2>
          <DocIcon name="chart" size={18} className="doc-icon--accent" />{" "}
          Telemetry
        </h2>
        <div className="live-controls telemetry-controls">
          <TelemetryExportButton
            label="Export telemetry JSON"
            onExport={exportHistory}
          />
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
      <div className="telemetry-views" role="group" aria-label="Telemetry view">
        <button
          aria-pressed={view === "performance"}
          onClick={() => setView("performance")}
        >
          <DocIcon name="chart" size={15} /> Performance
        </button>
        <button
          aria-pressed={view === "errors"}
          onClick={() => setView("errors")}
        >
          <DocIcon name="error" size={15} /> Error tracker
        </button>
      </div>
      {view === "errors" ? (
        <ErrorTracker
          active={active}
          refreshKey={refreshKey}
          pollInterval={DEFAULT_POLL_INTERVAL_MS}
        />
      ) : (
        <ApmPanel
          active={active}
          pollInterval={DEFAULT_POLL_INTERVAL_MS}
          refreshKey={refreshKey}
        />
      )}
    </div>
  );
}
