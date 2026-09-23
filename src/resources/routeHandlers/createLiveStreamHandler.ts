import type { Request, Response } from "express";
import type { Live, LiveEntryStamp } from "../live.resource";
import { getHealthSnapshot } from "../../utils/healthCollectors";

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

const TELEMETRY_CATEGORIES = ["logs", "emissions", "errors", "runs"] as const;
type TelemetryCategory = (typeof TELEMETRY_CATEGORIES)[number];
type TelemetryPage = Record<TelemetryCategory, LiveEntryStamp[]>;
/** Last delivered `sequence` per category; 0 means "from the beginning". */
type SequenceCursors = Record<TelemetryCategory, number>;

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

/** Reads the next page of every category after its own cursor. */
function readTelemetryPage(
  live: Live,
  cursors: SequenceCursors
): TelemetryPage {
  const page = (category: TelemetryCategory) => ({
    afterSequence: cursors[category],
    last: MAX_ENTRIES_PER_PUSH,
  });
  return {
    logs: live
      .getLogs(page("logs"))
      .map((l) => ({ ...l, data: safeStringify(l.data) })),
    emissions: live
      .getEmissions(page("emissions"))
      .map((e) => ({ ...e, payload: safeStringify(e.payload) })),
    errors: live
      .getErrors(page("errors"))
      .map((e) => ({ ...e, data: safeStringify(e.data) })),
    runs: live.getRuns(page("runs")),
  };
}

function isEmptyPage(page: TelemetryPage): boolean {
  return TELEMETRY_CATEGORIES.every((category) => page[category].length === 0);
}

function hasFullCategory(page: TelemetryPage): boolean {
  return TELEMETRY_CATEGORIES.some(
    (category) => page[category].length >= MAX_ENTRIES_PER_PUSH
  );
}

/**
 * Moves each cursor to the last entry its own category delivered. Pages come
 * back in ascending sequence order, so the last entry holds the maximum.
 */
function advanceCursors(cursors: SequenceCursors, page: TelemetryPage): void {
  for (const category of TELEMETRY_CATEGORIES) {
    const entries = page[category];
    if (entries.length > 0) {
      cursors[category] = entries[entries.length - 1].sequence;
    }
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
 * 5. Respects socket backpressure: pauses when a write reports a full buffer
 *    and resumes on `drain`, so a slow client never grows memory unbounded.
 * 6. Cleans up all timers and subscriptions on client disconnect.
 */
export function createLiveStreamHandler({ live }: LiveStreamDeps) {
  return (_req: Request, res: Response) => {
    // --- SSE headers ---------------------------------------------------------
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // nginx
    res.flushHeaders();

    // Independent sequence cursor per category: each getter pages on its own,
    // so advancing every category with one shared maximum would skip
    // undelivered entries in the categories lagging behind. Sequences are
    // unique, so a page cut can never split entries the way equal
    // millisecond timestamps could. Starting at 0 replays existing entries.
    const cursors: SequenceCursors = {
      logs: 0,
      emissions: 0,
      errors: 0,
      runs: 0,
    };
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let awaitingDrain = false;
    let closed = false;

    // --- Write helpers -------------------------------------------------------

    /**
     * Hands one frame to the socket. Returns false when it was NOT written
     * (connection closed, or paused until the socket drains).
     */
    const writeFrame = (frame: string): boolean => {
      if (closed || awaitingDrain) return false;
      try {
        // `false` means the frame was buffered but the socket is saturated:
        // hold further writes until it drains instead of queueing more.
        if (!res.write(frame)) awaitingDrain = true;
        return true;
      } catch {
        cleanup();
        return false;
      }
    };

    const sendEvent = (eventName: string, data: unknown): boolean =>
      writeFrame(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);

    /** Debounced notification handler — batches rapid record calls. */
    const onRecordNotification = () => {
      // While paused, the drain handler resumes from the unchanged cursors.
      if (closed || awaitingDrain || debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pushDelta();
      }, DEBOUNCE_MS);
    };

    /** Read new telemetry entries since the cursors, serialize, and push. */
    const pushDelta = () => {
      // Drain full pages so a burst larger than one page doesn't stall
      // behind the cursor until the next record arrives.
      for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_PUSH; pageIndex++) {
        if (closed || awaitingDrain) return;

        const page = readTelemetryPage(live, cursors);
        if (isEmptyPage(page)) return;
        // Cursors move only past what actually reached the socket.
        if (!sendEvent("telemetry", page)) return;
        advanceCursors(cursors, page);

        if (!hasFullCategory(page)) return;
      }

      // The loop only exits here via the page cap with a full last page, so
      // more backlog may remain. Schedule another bounded drain through the
      // debounce path (cleared on cleanup) instead of waiting for records.
      onRecordNotification();
    };

    const resumeAfterDrain = () => {
      if (!awaitingDrain) return;
      awaitingDrain = false;
      pushDelta();
    };

    // --- Subscriptions & timers ----------------------------------------------

    const unsubscribe = live.onRecord(onRecordNotification);

    // Health samples and heartbeats are skipped while paused: the next ones
    // carry fresher data and a saturated socket is anything but idle.
    const healthTimer = setInterval(() => {
      sendEvent("health", getHealthSnapshot());
    }, HEALTH_INTERVAL_MS);

    const heartbeatTimer = setInterval(() => {
      writeFrame(": heartbeat\n\n");
    }, HEARTBEAT_INTERVAL_MS);

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

    res.on("drain", resumeAfterDrain);
    res.on("close", cleanup);
    res.on("error", cleanup);

    // --- Initial push --------------------------------------------------------

    sendEvent("health", getHealthSnapshot());
    pushDelta(); // push any pre-existing entries
  };
}
