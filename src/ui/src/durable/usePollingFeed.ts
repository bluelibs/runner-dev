import { useCallback, useEffect, useRef, useState } from "react";

/** Retains the last successful value and shares in-flight reads with manual retries. */
export function usePollingFeed<T>(
  load: () => Promise<T>,
  initial: T,
  enabled: boolean,
  onError: (error: unknown) => void,
  interval: number | null = 2500
) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const active = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    pending.current = (async () => {
      try {
        const next = await load();
        if (active.current) {
          setData(next);
          setError("");
          setUpdatedAt(Date.now());
        }
      } catch (failure) {
        if (active.current) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not refresh data."
          );
          onError(failure);
        }
      } finally {
        if (active.current) setLoading(false);
        pending.current = null;
      }
    })();
    return pending.current;
  }, [load, onError]);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      if (!document.hidden) await refresh();
      if (!stopped && interval !== null)
        timer = window.setTimeout(poll, interval);
    };
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, interval, refresh]);
  return { data, loading, error, updatedAt, refresh };
}
