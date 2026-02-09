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

    let cursor = 0; // start from the beginning so the initial push picks up existing entries
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    // --- Write helpers -------------------------------------------------------

    /** Write a single SSE frame. */
    const sendEvent = (eventName: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    /** Read new telemetry entries since `cursor`, serialize, and push. */
    const pushDelta = () => {
      if (closed) return;

      const query = { afterTimestamp: cursor, last: MAX_ENTRIES_PER_PUSH };
      const logs = live
        .getLogs(query)
        .map((l) => ({ ...l, data: safeStringify(l.data) }));
      const emissions = live
        .getEmissions(query)
        .map((e) => ({ ...e, payload: safeStringify(e.payload) }));
      const errors = live
        .getErrors(query)
        .map((e) => ({ ...e, data: safeStringify(e.data) }));
      const runs = live.getRuns(query);

      if (logs.length + emissions.length + errors.length + runs.length === 0) {
        return;
      }

      // Advance cursor past everything we just delivered
      const latest = latestTimestamp(logs, emissions, errors, runs);
      if (latest !== undefined) cursor = latest;

      sendEvent("telemetry", { logs, emissions, errors, runs });
    };

    /** Debounced notification handler — batches rapid record calls. */
    const onRecordNotification = () => {
      if (closed || debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pushDelta();
      }, DEBOUNCE_MS);
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

    // If nothing existed, advance cursor to now so future pushes are incremental
    if (cursor === 0) cursor = Date.now() - 1;

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
