import type { RingBuffer } from "./RingBuffer";
import type { LiveCursorOptions, LiveEntryStamp } from "./types";

/** Bare-number queries are shorthand for an `afterTimestamp` cursor. */
export function toQueryOptions<T extends LiveCursorOptions>(
  input: number | T | undefined
): T | LiveCursorOptions {
  if (typeof input === "number") return { afterTimestamp: input };
  return input ?? {};
}

/**
 * Reads matching entries from a buffer whose entries were appended in
 * ascending `sequence` order, materializing only what the window needs.
 *
 * - `afterSequence` jumps straight to the first newer entry (binary search).
 * - With a cursor, `last` keeps the OLDEST N matches after it: cursor
 *   pagination must advance oldest-first, otherwise every entry beyond the
 *   page would be skipped for good once the cursor moves past it.
 * - Without a cursor, `last` keeps its "most recent N" meaning.
 */
export function queryEntries<T extends LiveEntryStamp>(
  buffer: RingBuffer<T>,
  options: LiveCursorOptions,
  matches: (entry: T) => boolean
): T[] {
  const { afterSequence, afterTimestamp, last } = options;
  const limit = typeof last === "number" ? Math.trunc(last) : Infinity;
  if (limit <= 0) return [];

  const startIndex =
    typeof afterSequence === "number"
      ? buffer.findFirstIndex((entry) => entry.sequence > afterSequence)
      : 0;
  // Timestamps are not guaranteed monotonic (clock adjustments), so the
  // timestamp cursor stays a plain filter rather than a search bound.
  const isWanted = (entry: T) =>
    (typeof afterTimestamp !== "number" ||
      entry.timestampMs > afterTimestamp) &&
    matches(entry);

  const hasCursor =
    typeof afterSequence === "number" || typeof afterTimestamp === "number";
  return hasCursor || limit === Infinity
    ? collectOldestFirst(buffer, startIndex, isWanted, limit)
    : collectNewestFirst(buffer, isWanted, limit).reverse();
}

function collectOldestFirst<T>(
  buffer: RingBuffer<T>,
  startIndex: number,
  isWanted: (entry: T) => boolean,
  limit: number
): T[] {
  const collected: T[] = [];
  for (
    let index = startIndex;
    index < buffer.size && collected.length < limit;
    index++
  ) {
    const entry = buffer.at(index);
    if (isWanted(entry)) collected.push(entry);
  }
  return collected;
}

function collectNewestFirst<T>(
  buffer: RingBuffer<T>,
  isWanted: (entry: T) => boolean,
  limit: number
): T[] {
  const collected: T[] = [];
  for (
    let index = buffer.size - 1;
    index >= 0 && collected.length < limit;
    index--
  ) {
    const entry = buffer.at(index);
    if (isWanted(entry)) collected.push(entry);
  }
  return collected;
}
