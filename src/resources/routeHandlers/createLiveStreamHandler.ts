import type { Request, Response } from "express";
import type { Live } from "../live.resource";
import {
  getHealthSnapshot,
  latestTimestamp,
} from "../../utils/healthCollectors";

/** Debounce interval (ms) for batching rapid record notifications into a single SSE push. */
const DEBOUNCE_MS = 100;
/** How often (ms) system health metrics (memory, cpu, eventLoop, gc) are pushed. */
const HEALTH_INTERVAL_MS = 2_000;
/** How often (ms) a heartbeat comment is sent to keep the connection alive through proxies. */
const HEARTBEAT_INTERVAL_MS = 15_000;
/** Maximum number of entries per category in a single SSE push. */
const MAX_ENTRIES_PER_PUSH = 1_000;
/** Maximum pages drained per push so bursts can't stall the tick forever. */
const MAX_PAGES_PER_PUSH = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeStringify(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// SSE route handler factory
// ---------------------------------------------------------------------------

export interface LiveStreamDeps {
  live: Live;
}

/**
 * Creates an Express route handler that streams live telemetry data via
 * Server-Sent Events (SSE). The handler:
 *
 * 1. Subscribes to `live.onRecord()` for near-instant push of new entries.
 * 2. Debounces rapid bursts (100 ms) to avoid flooding the connection.
 * 3. Pushes system health snapshots every 2 s on a separate cadence.
 * 4. Sends heartbeat comments every 15 s to keep proxies from closing idle connections.
 * 5. Cleans up all timers and subscriptions on client disconnect.
 */
export function createLiveStreamHandler({ live }: LiveStreamDeps) {
  return (_req: Request, res: Response) => {
    // --- SSE headers ---------------------------------------------------------
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nginx
    res.flushHeaders();

    // Independent cursor per category: each getter has its own 1,000-entry
    // window, so advancing every category with one shared maximum would skip
    // undelivered entries in the categories lagging behind. Start from the
    // beginning so the initial push picks up existing entries.
    const cursors = { logs: 0, emissions: 0, errors: 0, runs: 0 };
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    // --- Write helpers -------------------------------------------------------

    /** Write a single SSE frame. */
    const sendEvent = (eventName: string, data: unknown) => {
      if (closed) return;
      try {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        cleanup();
      }
    };

    /** Debounced notification handler — batches rapid record calls. */
    const onRecordNotification = () => {
      if (closed || debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pushDelta();
      }, DEBOUNCE_MS);
    };

    /** Read new telemetry entries since the cursors, serialize, and push. */
    const pushDelta = () => {
      if (closed) return;

      // Drain full pages so a burst larger than one page doesn't stall
      // behind the cursor until the next record arrives.
      for (let page = 0; page < MAX_PAGES_PER_PUSH && !closed; page++) {
        const logs = live
          .getLogs({
            afterTimestamp: cursors.logs,
            last: MAX_ENTRIES_PER_PUSH,
          })
          .map((l) => ({ ...l, data: safeStringify(l.data) }));
        const emissions = live
          .getEmissions({
            afterTimestamp: cursors.emissions,
            last: MAX_ENTRIES_PER_PUSH,
          })
          .map((e) => ({ ...e, payload: safeStringify(e.payload) }));
        const errors = live
          .getErrors({
            afterTimestamp: cursors.errors,
            last: MAX_ENTRIES_PER_PUSH,
          })
          .map((e) => ({ ...e, data: safeStringify(e.data) }));
        const runs = live.getRuns({
          afterTimestamp: cursors.runs,
          last: MAX_ENTRIES_PER_PUSH,
        });

        if (
          logs.length + emissions.length + errors.length + runs.length ===
          0
        ) {
          return;
        }

        // Advance each cursor only from its own delivered records. Cursors
        // are timestamp-based, so a page cut splitting entries that share
        // one millisecond timestamp skips the remainder sharing that stamp.
        const latestLogs = latestTimestamp(logs);
        if (latestLogs !== undefined) cursors.logs = latestLogs;
        const latestEmissions = latestTimestamp(emissions);
        if (latestEmissions !== undefined) cursors.emissions = latestEmissions;
        const latestErrors = latestTimestamp(errors);
        if (latestErrors !== undefined) cursors.errors = latestErrors;
        const latestRuns = latestTimestamp(runs);
        if (latestRuns !== undefined) cursors.runs = latestRuns;

        sendEvent("telemetry", { logs, emissions, errors, runs });

        const pageIsFull =
          logs.length >= MAX_ENTRIES_PER_PUSH ||
          emissions.length >= MAX_ENTRIES_PER_PUSH ||
          errors.length >= MAX_ENTRIES_PER_PUSH ||
          runs.length >= MAX_ENTRIES_PER_PUSH;
        if (!pageIsFull) return;
      }

      // The loop only exits here via the page cap with a full last page, so
      // more backlog may remain. Schedule another bounded drain through the
      // debounce path (cleared on cleanup) instead of waiting for records.
      if (!closed) onRecordNotification();
    };

    // --- Subscriptions & timers ----------------------------------------------

    const unsubscribe = live.onRecord(onRecordNotification);

    const healthTimer = setInterval(() => {
      if (!closed) sendEvent("health", getHealthSnapshot());
    }, HEALTH_INTERVAL_MS);

    const heartbeatTimer = setInterval(() => {
      if (!closed) res.write(": heartbeat\n\n");
    }, HEARTBEAT_INTERVAL_MS);

    // --- Initial push --------------------------------------------------------

    sendEvent("health", getHealthSnapshot());
    pushDelta(); // push any pre-existing entries

    // Categories that had nothing stay at 0; advance them to now so future
    // pushes are incremental.
    for (const key of ["logs", "emissions", "errors", "runs"] as const) {
      if (cursors[key] === 0) cursors[key] = Date.now() - 1;
    }

    // --- Cleanup on disconnect -----------------------------------------------

    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      clearInterval(healthTimer);
      clearInterval(heartbeatTimer);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };

    res.on("close", cleanup);
    res.on("error", cleanup);
  };
}
