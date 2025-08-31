import { useEffect, useMemo, useState } from "react";
import { graphqlRequest } from "../utils/graphqlClient";

export interface ThroughputPoint {
  t: number;
  success: number;
  error: number;
  canceled: number;
}

export interface LatencyPoint {
  t: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ErrorByTaskPoint {
  taskId: string;
  errors: number;
}

export interface UseMetricsResult {
  throughput: ThroughputPoint[];
  latency: LatencyPoint[];
  errorByTask: ErrorByTaskPoint[];
  heatmap: number[][]; // [7][24]
  isLoading: boolean;
}

// Placeholder metrics hook. Later, wire to live GraphQL / resources used by Live panel.
export function useMetrics(): UseMetricsResult {
  const [isLoading, setIsLoading] = useState(true);
  const [throughput, setThroughput] = useState<ThroughputPoint[]>([]);
  const [latency, setLatency] = useState<LatencyPoint[]>([]);
  const [errorByTask, setErrorByTask] = useState<ErrorByTaskPoint[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>(
    Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  );

  useEffect(() => {
    let cancelled = false;

    const LIVE_DATA_QUERY = `
      query LiveData($afterTimestamp: Float, $last: Int) {
        live {
          logs(afterTimestamp: $afterTimestamp, last: $last) {
            timestampMs
            level
            message
          }
          errors(afterTimestamp: $afterTimestamp, last: $last) {
            timestampMs
            sourceId
            sourceKind
            message
            sourceResolved { id }
          }
          runs(afterTimestamp: $afterTimestamp, last: $last) {
            timestampMs
            nodeId
            nodeKind
            ok
            durationMs
          }
        }
      }
    `;

    async function fetchAndAggregate(after?: number) {
      setIsLoading(true);
      try {
        const data = await graphqlRequest<{
          live: {
            logs: Array<{ timestampMs: number; level: string }>;
            errors: Array<{
              timestampMs: number;
              sourceId: string | null;
              sourceKind: string | null;
            }>;
            runs: Array<{
              timestampMs: number;
              nodeId: string;
              ok: boolean;
              durationMs?: number | null;
            }>;
          };
        }>(LIVE_DATA_QUERY, { last: 200, afterTimestamp: after });

        if (cancelled) return;

        const now = Date.now();
        const windowMinutes = 30;
        const bucketMs = 60_000;
        const start = now - windowMinutes * bucketMs;

        const buckets: Record<
          number,
          {
            success: number;
            error: number;
            canceled: number;
            durations: number[];
          }
        > = {};
        for (let i = 0; i < windowMinutes; i++) {
          const t = start + i * bucketMs;
          buckets[t] = { success: 0, error: 0, canceled: 0, durations: [] };
        }

        for (const run of data.live.runs || []) {
          if (run.timestampMs < start) continue;
          const t =
            Math.floor((run.timestampMs - start) / bucketMs) * bucketMs + start;
          const b = buckets[t];
          if (!b) continue;
          if (run.ok) b.success += 1;
          else b.error += 1; // no explicit canceled tracking yet
          if (typeof run.durationMs === "number")
            b.durations.push(run.durationMs);
        }

        const tp: ThroughputPoint[] = [];
        const lt: LatencyPoint[] = [];
        Object.keys(buckets)
          .map((k) => Number(k))
          .sort((a, b) => a - b)
          .forEach((t) => {
            const b = buckets[t];
            tp.push({
              t,
              success: b.success,
              error: b.error,
              canceled: b.canceled,
            });
            if (b.durations.length > 0) {
              const sorted = [...b.durations].sort((a, b) => a - b);
              const pick = (p: number) =>
                sorted[
                  Math.min(
                    sorted.length - 1,
                    Math.floor(p * (sorted.length - 1))
                  )
                ];
              lt.push({ t, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99) });
            } else {
              lt.push({ t, p50: 0, p95: 0, p99: 0 });
            }
          });

        const byTask: Record<string, number> = {};
        for (const err of data.live.errors || []) {
          const id = err.sourceId || "unknown";
          byTask[id] = (byTask[id] || 0) + 1;
        }
        const ebt = Object.entries(byTask)
          .map(([taskId, errors]) => ({ taskId, errors }))
          .sort((a, b) => b.errors - a.errors)
          .slice(0, 10);

        const grid: number[][] = Array.from({ length: 7 }, () =>
          Array.from({ length: 24 }, () => 0)
        );
        for (const log of data.live.logs || []) {
          const d = new Date(log.timestampMs);
          const day = d.getDay();
          const hour = d.getHours();
          grid[day][hour] += 1;
        }

        setThroughput(tp);
        setLatency(lt);
        setErrorByTask(ebt);
        setHeatmap(grid);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchAndAggregate();
    const id = window.setInterval(
      () => fetchAndAggregate(Date.now() - 5_000),
      5_000
    );
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { throughput, latency, errorByTask, heatmap, isLoading };
}
