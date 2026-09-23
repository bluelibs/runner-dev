/**
 * Fixed-capacity FIFO buffer with O(1) inserts. Once full, each push
 * overwrites the oldest item, so a busy telemetry store never pays for
 * shifting thousands of array slots on every record.
 *
 * Logical indexes run from 0 (oldest retained item) to `size - 1` (newest).
 */
export class RingBuffer<T> {
  // Grows until it reaches `capacity`, then becomes a circular store whose
  // oldest slot sits at `head`. Growing lazily keeps every slot populated,
  // so reads never have to deal with holes.
  private readonly slots: T[] = [];
  private head = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError(
        `RingBuffer capacity must be a non-negative integer, received ${capacity}`
      );
    }
  }

  get size(): number {
    return this.slots.length;
  }

  /** Appends an item, evicting the oldest one when the buffer is full. */
  push(item: T): void {
    if (this.capacity === 0) return;
    if (this.slots.length < this.capacity) {
      this.slots.push(item);
      return;
    }
    this.slots[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
  }

  /** Returns the item at a logical index (0 = oldest). */
  at(index: number): T {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(
        `RingBuffer index ${index} is out of range (size ${this.size})`
      );
    }
    return this.slots[(this.head + index) % this.size];
  }

  /**
   * Binary-searches for the first logical index whose item satisfies
   * `predicate`. The predicate must be monotonic over the buffer order
   * (false for a prefix, true afterwards), e.g. "sequence > cursor" on
   * items appended in ascending sequence order. Returns `size` when no item
   * matches.
   */
  findFirstIndex(predicate: (item: T) => boolean): number {
    let low = 0;
    let high = this.size;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (predicate(this.at(middle))) high = middle;
      else low = middle + 1;
    }
    return low;
  }
}
