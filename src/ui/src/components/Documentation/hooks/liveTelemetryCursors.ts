import type {
  SequencedEntry,
  TelemetryCategory,
  TelemetryCursors,
  TelemetryDelta,
} from "./liveTelemetry.types";

export const TELEMETRY_CATEGORIES: readonly TelemetryCategory[] = [
  "logs",
  "emissions",
  "errors",
  "runs",
];

export function emptyCursors(): TelemetryCursors {
  return { logs: null, emissions: null, errors: null, runs: null };
}

function unseen<T extends SequencedEntry>(
  entries: T[] | undefined,
  cursor: number | null
): T[] | undefined {
  if (entries === undefined || cursor === null) return entries;
  return entries.filter((entry) => entry.sequence > cursor);
}

/**
 * Drops entries at or before each category's cursor. SSE reconnects replay
 * the whole store and a manual refresh can overlap the stream, so this is
 * what keeps the view free of duplicates.
 */
export function keepUnseenEntries(
  delta: TelemetryDelta,
  cursors: TelemetryCursors
): TelemetryDelta {
  return {
    logs: unseen(delta.logs, cursors.logs),
    emissions: unseen(delta.emissions, cursors.emissions),
    errors: unseen(delta.errors, cursors.errors),
    runs: unseen(delta.runs, cursors.runs),
  };
}

function nextCursor(
  cursor: number | null,
  entries: SequencedEntry[] | undefined
): number | null {
  if (entries === undefined) return cursor;
  // A fetched-but-empty category with no cursor yet had nothing at all, so
  // everything from the start (0) is new from here on.
  return entries.reduce(
    (newest, entry) => Math.max(newest, entry.sequence),
    cursor ?? 0
  );
}

/**
 * Moves each fetched category's cursor to the newest sequence it returned.
 * Every category advances on its own: one shared maximum would skip entries
 * of a category that is still catching up.
 */
export function advanceCursors(
  cursors: TelemetryCursors,
  delta: TelemetryDelta
): TelemetryCursors {
  return {
    logs: nextCursor(cursors.logs, delta.logs),
    emissions: nextCursor(cursors.emissions, delta.emissions),
    errors: nextCursor(cursors.errors, delta.errors),
    runs: nextCursor(cursors.runs, delta.runs),
  };
}
