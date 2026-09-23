/**
 * Tracks the open live telemetry streams of one server so shutdown can end
 * them. An SSE response never goes idle, so `server.close()` would otherwise
 * wait on it for as long as a docs tab stays open, and the stream's timers
 * and record listener would keep running meanwhile.
 */
export class LiveStreamRegistry {
  private readonly openStreams = new Set<() => void>();
  private shuttingDown = false;

  /**
   * True once `endAll` ran. A stream handler checks it before writing any
   * header, because a stream opened now would never be ended.
   */
  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /** Registers a stream by the function that ends it. */
  add(endStream: () => void): void {
    if (this.shuttingDown) {
      throw new Error(
        "LiveStreamRegistry.add called after shutdown began; check isShuttingDown first."
      );
    }
    this.openStreams.add(endStream);
  }

  /** Forgets a stream that ended on its own (client disconnect). */
  delete(endStream: () => void): void {
    this.openStreams.delete(endStream);
  }

  /** Ends every open stream and refuses new ones. */
  endAll(): void {
    this.shuttingDown = true;
    // Copy first: each end callback removes itself from the set.
    for (const endStream of [...this.openStreams]) endStream();
  }

  get size(): number {
    return this.openStreams.size;
  }
}
