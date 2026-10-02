import React, { useEffect, useState } from "react";
import { BaseModal } from "../modals";
import { TraceView } from "./TraceView";
import {
  loadFailureDetails,
  loadRetainedTrace,
  type FailureSelection,
  type FailureDetails,
  type RetainedTrace,
} from "./apmFailureDetails";
import "./ApmFailuresModal.scss";

export function ApmFailuresModal({
  selection,
  onClose,
}: {
  selection: FailureSelection;
  onClose: () => void;
}) {
  const [failures, setFailures] = useState<FailureDetails[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<{
    correlationId: string;
    data: RetainedTrace;
  } | null>(null);
  const [loadingTrace, setLoadingTrace] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadFailureDetails(selection)
      .then((entries) => {
        if (active) {
          setFailures(entries.failures);
          setHasMore(entries.hasMore);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load failure details."
          );
      });
    return () => {
      active = false;
    };
  }, [selection]);
  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    const nextLimit = limit + 50;
    try {
      // Re-read a larger recent window to keep run/error joins intact across page boundaries.
      const page = await loadFailureDetails(selection, nextLimit);
      setFailures(page.failures);
      setHasMore(page.hasMore);
      setLimit(nextLimit);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load older failures."
      );
    } finally {
      setLoadingMore(false);
    }
  }
  async function openTrace(correlationId: string) {
    setLoadingTrace(correlationId);
    setError(null);
    try {
      setTrace({ correlationId, data: await loadRetainedTrace(correlationId) });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load the trace."
      );
    } finally {
      setLoadingTrace(null);
    }
  }
  return (
    <>
      <BaseModal
        isOpen
        onClose={onClose}
        title="Retained failures"
        subtitle={selection.nodeId}
        size="lg"
        className="apm-failures"
      >
        <p className="apm-failures__note">
          Last {selection.windowMinutes} minutes · {selection.scope} calls ·{" "}
          {failures?.length ?? 0} failure details loaded. Performance history
          and error details have separate retention.
        </p>
        {error && <p role="alert">{error}</p>}
        {!failures && !error && <p>Loading failure details…</p>}
        {failures?.length === 0 && (
          <p>
            No matching failure details were found in the latest {limit}{" "}
            retained runs and errors. APM counts can remain after logs and
            execution details expire.
          </p>
        )}
        {hasMore && (
          <button disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading older errors…" : "Load older errors"}
          </button>
        )}
        {failures && !hasMore && (
          <p className="apm-failures__note">
            All matching retained details loaded.
          </p>
        )}
        {failures?.map((failure) => (
          <article key={failure.sequence} className="apm-failures__entry">
            <div className="apm-failures__heading">
              <time>{new Date(failure.timestampMs).toLocaleString()}</time>
              {failure.correlationId ? (
                <button
                  disabled={loadingTrace !== null}
                  onClick={() => {
                    if (failure.correlationId)
                      void openTrace(failure.correlationId);
                  }}
                >
                  {loadingTrace === failure.correlationId
                    ? "Loading trace…"
                    : "View trace & logs"}
                </button>
              ) : (
                <span>No correlation ID retained</span>
              )}
            </div>
            <strong>{failure.message}</strong>
            {failure.correlationId && <code>{failure.correlationId}</code>}
            {failure.stack && (
              <details>
                <summary>Error stack</summary>
                <pre>{failure.stack}</pre>
              </details>
            )}
          </article>
        ))}
        {trace && (
          <p className="apm-failures__note">
            Trace shows up to 200 retained records per category.
          </p>
        )}
      </BaseModal>
      {trace && (
        <TraceView
          correlationId={trace.correlationId}
          {...trace.data}
          onClose={() => setTrace(null)}
        />
      )}
    </>
  );
}
