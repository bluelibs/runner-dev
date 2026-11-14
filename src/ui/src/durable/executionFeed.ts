import { useEffect, useRef, useState } from "react";
import type { StudioExecutionSummary } from "../../../durable/shared/types";
import type { ExecutionFilters, StudioApi } from "./api";
import { ExecutionPager, type PagerSnapshot } from "./executionPager";
export { EXECUTION_PAGE_SIZE } from "./executionPager";

/** Merges summaries by exact storage identity in canonical listing order. */
export function mergeExecutions(
  current: StudioExecutionSummary[],
  incoming: StudioExecutionSummary[]
): StudioExecutionSummary[] {
  const rows = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) rows.set(row.id, row);
  return [...rows.values()].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      left.id.localeCompare(right.id)
  );
}

/** Query changes dispose the old pager, including any late in-flight responses. */
export function useExecutionFeed({
  api,
  paused,
  onError,
  workflowKey,
  status,
  executionId,
}: {
  api: StudioApi;
  paused: boolean;
  onError: (error: unknown) => void;
} & ExecutionFilters) {
  const [snapshot, setSnapshot] = useState<PagerSnapshot>({
    executions: [],
    startOffset: 0,
    totalCount: null,
    hasMore: false,
    hasPrevious: false,
    loading: true,
    loadingMore: false,
    error: null,
    updatedAt: null,
  });
  const pagerRef = useRef<ExecutionPager>();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const pager = new ExecutionPager(
      api,
      { workflowKey, status, executionId },
      setSnapshot,
      onError
    );
    pagerRef.current = pager;
    setSnapshot(pager.snapshot);
    const debounce = window.setTimeout(
      () => void pager.refreshHead(),
      executionId ? 250 : 0
    );
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      if (!document.hidden && !pausedRef.current) await pager.poll();
      if (!stopped) timer = window.setTimeout(poll, 2500);
    };
    timer = window.setTimeout(poll, 2500);
    const onVisible = () => {
      if (!document.hidden && !pausedRef.current) void pager.poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      pager.dispose();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(debounce);
      window.clearTimeout(timer);
    };
  }, [api, onError, workflowKey, status, executionId]);
  const actions = useRef({
    retry: async () => {
      await pagerRef.current?.retry();
    },
    loadMore: async () => {
      await pagerRef.current?.loadMore();
    },
    loadPrevious: async () => {
      await pagerRef.current?.loadPrevious();
    },
    refreshHead: async () => {
      await pagerRef.current?.refreshHead();
    },
  });
  return { ...snapshot, ...actions.current };
}
