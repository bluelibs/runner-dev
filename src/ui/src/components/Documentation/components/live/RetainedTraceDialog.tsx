import React, { useCallback, useRef, useState } from "react";
import { LoadingSkeleton } from "../../../LoadingSkeleton";
import { useHistoryQuery } from "../../hooks/useHistoryQuery";
import { loadRetainedTrace } from "./apmFailureDetails";
import { TraceDialog, TraceTimeline } from "./TraceView";

export function RetainedTraceDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [attempt, retry] = useState(0);
  const load = useCallback(() => loadRetainedTrace(id), [id]);
  const { snapshot, failure } = useHistoryQuery(
    load,
    { active: false, pollInterval: 0, refreshKey: attempt },
    { debounceMs: 0 }
  );
  return (
    <TraceDialog
      correlationId={id}
      onClose={onClose}
      closeButtonRef={closeButton}
    >
      {failure ? (
        <p role="alert">
          {failure}{" "}
          <button
            onClick={() => {
              closeButton.current?.focus();
              retry(attempt + 1);
            }}
          >
            Retry trace
          </button>
        </p>
      ) : snapshot ? (
        <TraceTimeline {...snapshot} correlationId={id} />
      ) : (
        <LoadingSkeleton label="Loading trace" layout="detail" rows={3} />
      )}
    </TraceDialog>
  );
}
