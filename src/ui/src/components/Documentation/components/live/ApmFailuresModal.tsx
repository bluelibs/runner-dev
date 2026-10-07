import React, { useEffect, useRef, useState } from "react";
import { BaseModal } from "../modals";
import { TraceView } from "./TraceView";
import {
  loadFailureDetails,
  loadRetainedTrace,
  type FailureSelection,
  mergeFailurePages,
  type FailureDetailsPage,
  type RetainedTrace,
} from "./apmFailureDetails";
import { VirtualFailureList } from "./VirtualFailureList";
import "./ApmFailuresModal.scss";

export function ApmFailuresModal({
  selection,
  onClose,
}: {
  selection: FailureSelection;
  onClose: () => void;
}) {
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState<FailureDetailsPage | null>(null);
  const failures = page?.failures;
  const hasMore = page?.hasMore ?? false;
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<{
    correlationId: string;
    data: RetainedTrace;
  } | null>(null);
  const [loadingTrace, setLoadingTrace] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    generation.current++;
    setPage(null);
    setError(null);
    setLoadingMore(false);
    inFlight.current = false;
    loadFailureDetails(selection)
      .then((entries) => {
        if (active) {
          setPage(entries);
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
      generation.current++;
    };
  }, [selection, retryKey]);
  async function loadMore() {
    if (inFlight.current || !page?.hasMore) return;
    const currentGeneration = generation.current;
    inFlight.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await loadFailureDetails(selection, page.cursor);
      if (currentGeneration === generation.current)
        setPage((current) => mergeFailurePages(selection, current, next));
    } catch (cause) {
      if (currentGeneration === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load older failures."
        );
    } finally {
      if (currentGeneration === generation.current) {
        inFlight.current = false;
        setLoadingMore(false);
      }
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
        {!page && error && (
          <button onClick={() => setRetryKey((value) => value + 1)}>
            Retry loading errors
          </button>
        )}
        {!failures && !error && <p>Loading failure details…</p>}
        {failures?.length === 0 && (
          <p>
            No matching failure details were found in the loaded pages. APM
            counts can remain after logs and execution details expire.
          </p>
        )}
        {error && hasMore && (
          <button disabled={loadingMore} onClick={() => void loadMore()}>
            Retry loading older errors
          </button>
        )}
        {failures && (
          <VirtualFailureList
            failures={failures}
            hasMore={hasMore}
            loading={loadingMore}
            error={!!error}
            onLoadMore={() => void loadMore()}
            onTrace={(id) => void openTrace(id)}
            loadingTrace={loadingTrace}
          />
        )}
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
