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
   * Registers a stream by the function that ends it. Returns false once
   * shutdown has begun: the caller must then end the stream right away.
   */
  add(endStream: () => void): boolean {
    if (this.shuttingDown) return false;
    this.openStreams.add(endStream);
    return true;
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
