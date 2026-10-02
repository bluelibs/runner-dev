import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FailureDetails } from "./apmFailureDetails";

function MeasuredFailure({
  children,
  onHeight,
}: {
  children: React.ReactNode;
  onHeight: (height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height > 0) onHeight(height);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeight]);
  return (
    <div ref={ref} style={{ paddingBottom: 16 }}>
      {children}
    </div>
  );
}

/** Only the viewport and a small overscan mount, including variable-height expanded stacks. */
export function VirtualFailureList({
  failures,
  hasMore,
  loading,
  error,
  onLoadMore,
  onTrace,
  loadingTrace,
}: {
  failures: FailureDetails[];
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
  onTrace: (id: string) => void;
  loadingTrace: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [heights, setHeights] = useState<Map<number, number>>(() => new Map());
  const offsets = useMemo(() => {
    const result = [0];
    for (const failure of failures)
      result.push(
        result[result.length - 1] + (heights.get(failure.sequence) ?? 220)
      );
    return result;
  }, [failures, heights]);
  const total = offsets[offsets.length - 1];
  let low = 0,
    high = failures.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle + 1] < top - 500) low = middle + 1;
    else high = middle;
  }
  const start = low;
  let end = start;
  while (end < failures.length && offsets[end] < top + height + 500) end++;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      if (element.clientHeight) setHeight(element.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (hasMore && !loading && !error && total - top - height < 500)
      onLoadMore();
  }, [hasMore, loading, error, total, top, height, onLoadMore]);
  return (
    <div
      ref={root}
      className="apm-failures__list"
      role="feed"
      aria-label="Retained error list"
      aria-busy={loading}
      tabIndex={0}
      onScroll={(event) => setTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: total, position: "relative" }}>
        {failures.slice(start, end).map((failure, index) => (
          <div
            key={failure.sequence}
            style={{
              position: "absolute",
              top: offsets[start + index],
              left: 0,
              right: 0,
            }}
          >
            <MeasuredFailure
              onHeight={(value) =>
                setHeights((current) => {
                  if (current.get(failure.sequence) === value) return current;
                  const next = new Map(current);
                  next.set(failure.sequence, value);
                  return next;
                })
              }
            >
              <article
                className="apm-failures__entry"
                aria-posinset={start + index + 1}
                aria-setsize={hasMore ? -1 : failures.length}
              >
                <div className="apm-failures__heading">
                  <time>{new Date(failure.timestampMs).toLocaleString()}</time>
                  {failure.correlationId ? (
                    <button
                      disabled={loadingTrace !== null}
                      onClick={() => {
                        if (failure.correlationId)
                          onTrace(failure.correlationId);
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
            </MeasuredFailure>
          </div>
        ))}
      </div>
      <p className="apm-failures__note" role="status">
        {loading
          ? "Loading older errors…"
          : hasMore
          ? "Scroll for older errors"
          : "All matching retained details loaded."}
      </p>
    </div>
  );
}
