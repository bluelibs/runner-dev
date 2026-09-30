/**
 * Sequence values reserved per wall-clock millisecond. Seeding the counter
 * from the clock keeps sequences increasing across process restarts, so a
 * client still holding a cursor from a previous run keeps receiving new
 * entries instead of waiting for a restarted counter to catch up.
 * `Date.now() * 1000` stays below Number.MAX_SAFE_INTEGER until year 2255.
 */
const SEQUENCES_PER_MILLISECOND = 1_000;

/**
 * Creates the store-wide sequence generator: strictly increasing and never
 * reused. `max` keeps it strictly increasing through same-millisecond bursts
 * and backwards clock adjustments alike.
 */
export function createSequenceClock(
  initialSequence = 0
): (timestampMs: number) => number {
  let lastSequence = initialSequence;
  return (timestampMs) => {
    lastSequence = Math.max(
      lastSequence + 1,
      Math.floor(timestampMs) * SEQUENCES_PER_MILLISECOND
    );
    if (!Number.isSafeInteger(lastSequence)) {
      throw new Error(
        "Live telemetry sequence exceeded the safe integer range."
      );
    }
    return lastSequence;
  };
}
