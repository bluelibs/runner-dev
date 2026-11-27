import React, { useCallback, useState } from "react";
import type { Introspector } from "../../../../../../resources/models/Introspector";
import type { LogEntry } from "../../hooks/liveTelemetry.types";
import {
  useHistoryQuery,
  type HistoryUpdates,
} from "../../hooks/useHistoryQuery";
import { graphqlRequest } from "../../utils/graphqlClient";
import { RecentLogs } from "./RecentLogs";
import { RetainedTraceDialog } from "./RetainedTraceDialog";
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
  const { snapshot, failure, pending } = useHistoryQuery(load, updates, {
    debounceMs: query ? 150 : 0,
    retainKey: JSON.stringify([level, query]),
  });
  return (
    <>
      {failure && <p role="alert">{failure}</p>}
      <RecentLogs
        introspector={introspector}
        logs={snapshot?.slice(-limit) ?? []}
        historySearch={{
          query,
          setQuery: search,
          pending: !snapshot && pending,
          appending: Boolean(snapshot && pending),
          unavailable: !snapshot && Boolean(failure),
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
        <RetainedTraceDialog
          key={correlationId}
          id={correlationId}
          onClose={() => setCorrelationId("")}
        />
      )}
    </>
  );
}
