import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { useCallback, useState } from "react";
import type { StudioApi } from "../api";
import { useHistoryQuery } from "../../components/Documentation/hooks/useHistoryQuery";
import { formatDateTime } from "../format";
import { Modal } from "./Modal";
import { StatusPill } from "./StatusPill";

export function ScheduleRuns({
  api,
  id,
  onOpen,
  onClose,
}: {
  api: StudioApi;
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [revision, refresh] = useState(0);
  const cursor = cursors.at(-1);
  const load = useCallback(
    () => api.listScheduleRuns(id, cursor),
    [api, id, cursor]
  );
  const { snapshot, failure } = useHistoryQuery(
    load,
    {
      active: !cursor,
      refreshKey: revision,
      pollInterval: 5000,
    },
    { debounceMs: 0 }
  );
  const next = snapshot?.nextCursor;
  return (
    <Modal title="Schedule runs" subtitle={id} onClose={onClose}>
      <div className="schedule-runs-body">
        {failure && (
          <p role="alert">
            {failure}{" "}
            <button
              className="btn ghost small"
              onClick={() => refresh(revision + 1)}
            >
              Retry
            </button>
          </p>
        )}
        {!snapshot && !failure && (
          <LoadingSkeleton label="Loading runs" layout="detail" />
        )}
        {snapshot &&
          (snapshot.executions.length ? (
            <ul className="schedule-runs-list">
              {snapshot.executions.map((run) => (
                <li key={run.id}>
                  <button onClick={() => onOpen(run.id)}>
                    <span>
                      <strong>{formatDateTime(run.createdAt)}</strong>
                      <code>{run.id}</code>
                    </span>
                    <StatusPill status={run.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {next || cursor
                ? "No runs in this part of the retained history."
                : "No retained runs for this schedule."}
            </p>
          ))}
        <div className="schedule-actions">
          {cursors.length > 1 && (
            <button
              className="btn ghost small"
              onClick={() => setCursors(cursors.slice(0, -1))}
            >
              Newer history
            </button>
          )}
          {next && (
            <button
              className="btn ghost small"
              onClick={() => setCursors([...cursors, next])}
            >
              Older history
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
