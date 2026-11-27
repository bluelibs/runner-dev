import { useEffect, useState } from "react";

export interface HistoryUpdates {
  active: boolean;
  refreshKey: number;
  pollInterval: number;
}

/** Debounce edits and ignore stale completions when a search or view changes. */
export function useHistoryQuery<T>(
  load: () => Promise<T>,
  { active, refreshKey, pollInterval }: HistoryUpdates
) {
  const [result, setResult] = useState<{
    load: typeof load;
    snapshot: T | null;
    failure: string;
  }>();
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const value = await load();
        if (!disposed) setResult({ load, snapshot: value, failure: "" });
      } catch (error) {
        if (!disposed)
          setResult((previous) => ({
            load,
            snapshot: previous?.load === load ? previous.snapshot : null,
            failure:
              error instanceof Error
                ? error.message
                : "Could not load history.",
          }));
      } finally {
        if (!disposed && active) timer = setTimeout(refresh, pollInterval);
      }
    }
    timer = setTimeout(refresh, 150);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [load, active, refreshKey, pollInterval]);
  return result?.load === load ? result : { snapshot: null, failure: "" };
}
