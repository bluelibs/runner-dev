/**
 * Shared system health collectors used by both the GraphQL live resolvers
 * and the SSE stream handler. Centralises event‐loop delay, GC tracking,
 * and CPU ELU measurement so only one set of observers exists per process.
 */
import * as os from "node:os";
import {
  monitorEventLoopDelay,
  performance,
  PerformanceObserver,
  type EventLoopUtilization,
  type IntervalHistogram,
} from "node:perf_hooks";

// ---------------------------------------------------------------------------
// Event‐loop delay histogram
// ---------------------------------------------------------------------------

let histogram: IntervalHistogram | undefined;
try {
  histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
} catch {
  // Unsupported runtime (e.g. older Node or non‐Node)
}

/** Mean event‐loop delay in nanoseconds. */
export function getEventLoopMeanNs(): number {
  return histogram?.mean ?? 0;
}

/** Reset the event‐loop delay histogram (for the optional `reset` arg). */
export function resetEventLoopHistogram(): void {
  try {
    histogram?.reset();
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// GC tracking — both lifetime totals and a windowed ring buffer
// ---------------------------------------------------------------------------

/** Total GC collections observed since process start. */
export let gcTotalCollections = 0;
/** Total GC pause duration (ms) since process start. */
export let gcTotalDurationMs = 0;

const gcEvents: { ts: number; duration: number }[] = [];
const GC_EVENTS_MAX = 10_000;

function pushGcEvent(duration: number) {
  gcEvents.push({ ts: Date.now(), duration });
  if (gcEvents.length > GC_EVENTS_MAX) {
    gcEvents.splice(0, Math.floor(GC_EVENTS_MAX * 0.1));
  }
}

try {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      gcTotalCollections += 1;
      gcTotalDurationMs += entry.duration;
      pushGcEvent(entry.duration);
    }
  });
  obs.observe({ entryTypes: ["gc"], buffered: true });
} catch {
  // noop — GC observation not available
}

/** Return GC stats within a sliding time window. */
export function getGcWindow(windowMs: number): {
  collections: number;
  duration: number;
} {
  const since = Date.now() - windowMs;
  let collections = 0;
  let duration = 0;
  for (let i = gcEvents.length - 1; i >= 0; i--) {
    if (gcEvents[i].ts < since) break;
    collections += 1;
    duration += gcEvents[i].duration;
  }
  return { collections, duration };
}

// ---------------------------------------------------------------------------
// CPU utilisation via Event Loop Utilisation (ELU)
// ---------------------------------------------------------------------------

let prevElu: EventLoopUtilization | undefined;

export function getCpuEluUtilization(): number {
  try {
    const current = prevElu
      ? performance.eventLoopUtilization(prevElu)
      : performance.eventLoopUtilization();
    prevElu = current;
    return Number.isFinite(current.utilization) ? current.utilization : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Composite health snapshot (used by SSE handler)
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  memory: { heapUsed: number; heapTotal: number; rss: number };
  cpu: { usage: number; loadAverage: number };
  eventLoop: { lag: number };
  gc: { collections: number; duration: number };
}

export function getHealthSnapshot(gcWindowMs = 30_000): HealthSnapshot {
  const m = process.memoryUsage();
  const meanNs = getEventLoopMeanNs();
  const gc = getGcWindow(gcWindowMs);

  return {
    memory: { heapUsed: m.heapUsed, heapTotal: m.heapTotal, rss: m.rss },
    cpu: { usage: getCpuEluUtilization(), loadAverage: os.loadavg()[0] ?? 0 },
    eventLoop: { lag: Number.isFinite(meanNs) ? meanNs / 1e6 : 0 },
    gc,
  };
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

/** Extract the latest `timestampMs` from one or more arrays of timestamped entries. */
export function latestTimestamp(
  ...arrays: Array<{ timestampMs: number }[]>
): number | undefined {
  let max: number | undefined;
  for (const arr of arrays) {
    for (const entry of arr) {
      if (max === undefined || entry.timestampMs > max) {
        max = entry.timestampMs;
      }
    }
  }
  return max;
}
