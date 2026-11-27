import { useEffect, useState } from "react";

export interface HistoryUpdates {
  active: boolean;
  refreshKey: number;
  pollInterval: number;
}

/** Debounce edits and ignore stale completions when a search or view changes. */
export function useHistoryQuery<T>(
  load: () => Promise<T>,
  { active, refreshKey, pollInterval }: HistoryUpdates,
  {
    debounceMs = 150,
    retainKey,
  }: { debounceMs?: number; retainKey?: string } = {}
) {
  const key = retainKey ?? load;
  const [result, setResult] = useState<{
    load: typeof load;
    refreshKey: number;
    key: typeof key;
    snapshot: T | null;
    failure: string;
  }>();
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const value = await load();
        if (!disposed)
          setResult({ key, load, refreshKey, snapshot: value, failure: "" });
      } catch (error) {
        if (!disposed)
          setResult((previous) => ({
            key,
            load,
            refreshKey,
            snapshot: previous?.key === key ? previous.snapshot : null,
            failure:
              error instanceof Error
                ? error.message
                : "Could not load history.",
          }));
      } finally {
        if (!disposed && active) timer = setTimeout(refresh, pollInterval);
      }
    }
    if (debounceMs) timer = setTimeout(refresh, debounceMs);
    else void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [load, active, refreshKey, pollInterval, debounceMs, key]);
  return {
    snapshot: result?.key === key ? result.snapshot : null,
    failure:
      result?.load === load && result.refreshKey === refreshKey
        ? result.failure
        : "",
    pending:
      result?.load !== load ||
      (!result.snapshot && result.refreshKey !== refreshKey),
  };
}
