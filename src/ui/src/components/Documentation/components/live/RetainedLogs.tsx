import React, { useCallback, useState } from "react";
import type { Introspector } from "../../../../../../resources/models/Introspector";
import type { LogEntry } from "../../hooks/liveTelemetry.types";
import {
  useHistoryQuery,
  type HistoryUpdates,
} from "../../hooks/useHistoryQuery";
import { graphqlRequest } from "../../utils/graphqlClient";
import { RecentLogs } from "./RecentLogs";
import { loadRetainedTrace } from "./apmFailureDetails";
import { TraceView } from "./TraceView";
import { downloadTelemetry } from "./telemetryExport";
import { TelemetryExportButton } from "./TelemetryExportButton";

const QUERY = `query SearchLogHistory($search:String, $last:Int, $levels:[LogLevelEnum!]) {
  live { logs(filter:{search:$search,levels:$levels},last:$last) {sequence timestampMs level sourceId message correlationId data} }
}`;
function findLogs(search: string, level: string, last?: number) {
  return graphqlRequest<{ live: { logs: LogEntry[] } }>(QUERY, {
    search,
    levels: level ? [level] : [],
    last,
  }).then((data) => data.live.logs);
}

export function RetainedLogs({
  introspector,
  level,
  query,
  setQuery,
  ...updates
}: HistoryUpdates & {
  introspector: Introspector;
  level: string;
  query: string;
  setQuery: (query: string) => void;
}) {
  const [limit, setLimit] = useState(50);
  const [correlationId, setCorrelationId] = useState("");
  const search = useCallback(
    (value: string) => {
      setQuery(value);
      setLimit(50);
    },
    [setQuery]
  );
  const load = useCallback(
    () => findLogs(query, level, limit + 1),
    [query, level, limit]
  );
  const { snapshot, failure } = useHistoryQuery(load, updates);
  return (
    <>
      {failure && <p role="alert">{failure}</p>}
      <RecentLogs
        introspector={introspector}
        logs={snapshot?.slice(-limit) ?? []}
        historySearch={{
          query,
          setQuery: search,
          loadMore:
            snapshot && snapshot.length > limit
              ? () => setLimit(limit + 50)
              : undefined,
        }}
        onCorrelationIdClick={setCorrelationId}
      />
      <div className="issue-actions">
        <TelemetryExportButton
          label="Export matching logs"
          onExport={async () =>
            downloadTelemetry("logs", {
              query,
              level: level || "all",
              logs: await findLogs(query, level),
            })
          }
        />
      </div>
      {correlationId && (
        <LogTrace
          key={correlationId}
          id={correlationId}
          onClose={() => setCorrelationId("")}
        />
      )}
    </>
  );
}

function LogTrace({ id, onClose }: { id: string; onClose: () => void }) {
  const [attempt, retry] = useState(0);
  const load = useCallback(() => loadRetainedTrace(id), [id]);
  const { snapshot, failure } = useHistoryQuery(load, {
    active: false,
    pollInterval: 0,
    refreshKey: attempt,
  });
  if (failure)
    return (
      <p role="alert">
        {failure}{" "}
        <button onClick={() => retry(attempt + 1)}>Retry trace</button>
      </p>
    );
  return snapshot ? (
    <TraceView {...snapshot} correlationId={id} onClose={onClose} />
  ) : (
    <p>Loading trace…</p>
  );
}
