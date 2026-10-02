import type { RunRecord } from "./types";
export function bufferedApmWriter(
  write: (samples: RunRecord[]) => Promise<void> | void,
  options: {
    batchSize?: number;
    maxPendingSamples?: number;
    flushIntervalMs?: number;
  } = {}
) {
  const batchSize = options.batchSize ?? 1000,
    maxPending = options.maxPendingSamples ?? 10_000;
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    !Number.isInteger(maxPending) ||
    maxPending < batchSize
  )
    throw new Error("Invalid APM writer queue limits.");
  if (
    !Number.isInteger(options.flushIntervalMs ?? 1000) ||
    (options.flushIntervalMs ?? 1000) < 1
  )
    throw new Error("Invalid APM flush interval.");
  const pending: RunRecord[] = [];
  let inFlight = 0;
  let closed = false;
  let failure: Error | null = null;
  let flushing: Promise<void> | undefined;
  async function drain() {
    while (pending.length) {
      const batch = pending.splice(0, batchSize);
      inFlight = batch.length;
      try {
        await write(batch);
      } finally {
        inFlight = 0;
      }
    }
  }
  function flush(): Promise<void> {
    if (failure) return Promise.reject(failure);
    if (flushing) return flushing;
    flushing = drain()
      .catch((cause) => {
        failure =
          cause instanceof Error ? cause : new Error("APM write failed.");
        throw failure;
      })
      .finally(() => {
        flushing = undefined;
      });
    return flushing;
  }
  const timer = setInterval(() => {
    if (pending.length) void flush().catch(() => {});
  }, options.flushIntervalMs ?? 1000);
  timer.unref();
  function assertReady() {
    if (failure) throw failure;
    if (closed) throw new Error("APM writer is closed.");
  }
  return {
    assertReady,
    append(sample: RunRecord): undefined {
      assertReady();
      if (pending.length + inFlight >= maxPending)
        throw new Error("APM writer queue is full.");
      pending.push(sample);
      if (pending.length >= batchSize) void flush().catch(() => {});
      return undefined;
    },
    flush,
    status: () => ({
      pendingSamples: pending.length + inFlight,
      error: failure?.message ?? null,
    }),
    async close() {
      closed = true;
      clearInterval(timer);
      await flush();
    },
  };
}
