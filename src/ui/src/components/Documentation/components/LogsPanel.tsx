import React, { useState } from "react";
import type { Introspector } from "../../../../../resources/models/Introspector";
import { DEFAULT_POLL_INTERVAL_MS } from "../hooks/useLiveStream";
import { LogLevelFilter, type LevelFilter } from "./live/LogLevelFilter";
import { ErrorTracker } from "./live/ErrorTracker";
import { RetainedLogs } from "./live/RetainedLogs";
import { DocIcon } from "./common/DocIcon";

export function LogsPanel({ introspector }: { introspector: Introspector }) {
  const [active, setActive] = useState(true);
  const [refreshKey, refresh] = useState(0);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("");
  const updates = {
    active,
    refreshKey,
    pollInterval: DEFAULT_POLL_INTERVAL_MS,
  };
  return (
    <div className="live-panel">
      <div className="live-header">
        <h2>
          <DocIcon name="list" size={18} className="doc-icon--accent" /> Log
          explorer
        </h2>
        <div className="live-controls telemetry-controls">
          <button className="clean-button" onClick={() => setActive(!active)}>
            {active ? "⏸ Pause" : "▶ Resume"} Updates
          </button>
          <button
            className="clean-button"
            onClick={() => refresh(refreshKey + 1)}
          >
            Refresh
          </button>
          <LogLevelFilter value={level} onChange={setLevel} />
        </div>
      </div>
      {level === "error" ? (
        <ErrorTracker search={{ query, setQuery }} {...updates} />
      ) : (
        <RetainedLogs
          key={level}
          query={query}
          setQuery={setQuery}
          {...updates}
          level={level}
          introspector={introspector}
        />
      )}
    </div>
  );
}
