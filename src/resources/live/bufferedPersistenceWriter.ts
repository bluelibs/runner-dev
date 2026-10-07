export function bufferedPersistenceWriter<T>(
  write: (samples: T[]) => Promise<void> | void,
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
    throw new Error("Invalid Persistence writer queue limits.");
  if (
    !Number.isInteger(options.flushIntervalMs ?? 1000) ||
    (options.flushIntervalMs ?? 1000) < 1
  )
    throw new Error("Invalid Persistence flush interval.");
  const pending: T[] = [];
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
  async function flush(): Promise<void> {
    if (failure) throw failure;
    if (!pending.length && !flushing) return;
    flushing ??= drain()
      .catch((cause) => {
        failure =
          cause instanceof Error
            ? cause
            : new Error("Persistence write failed.");
        throw failure;
      })
      .finally(() => {
        flushing = undefined;
      });
    await flushing;
    // Appends may arrive after drain finishes but before its completion is observed.
    if (pending.length) await flush();
  }
  const timer = setInterval(() => {
    if (pending.length) void flush().catch(() => {});
  }, options.flushIntervalMs ?? 1000);
  timer.unref();
  function assertReady() {
    if (failure) throw failure;
    if (closed) throw new Error("Persistence writer is closed.");
  }
  return {
    assertReady,
    append(sample: T): undefined {
      assertReady();
      if (pending.length + inFlight >= maxPending)
        throw new Error("Persistence writer queue is full.");
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
