import { RingBuffer } from "../../resources/live/RingBuffer";

function contents<T>(buffer: RingBuffer<T>): T[] {
  return Array.from({ length: buffer.size }, (_, index) => buffer.at(index));
}

describe("RingBuffer", () => {
  test.each([-1, 1.5, Number.NaN])("rejects capacity %p", (capacity) => {
    expect(() => new RingBuffer<number>(capacity)).toThrow(RangeError);
  });

  test("grows until full, then overwrites the oldest item", () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    expect(contents(buffer)).toEqual([1, 2]);

    buffer.push(3);
    buffer.push(4);
    buffer.push(5);
    expect(buffer.size).toBe(3);
    expect(contents(buffer)).toEqual([3, 4, 5]);

    // Several full laps keep the logical order intact.
    for (let value = 6; value <= 10; value++) buffer.push(value);
    expect(contents(buffer)).toEqual([8, 9, 10]);
  });

  test("retains nothing with zero capacity", () => {
    const buffer = new RingBuffer<number>(0);
    buffer.push(1);
    expect(buffer.size).toBe(0);
  });

  test.each([-1, 2, 0.5])("throws for out-of-range index %p", (index) => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    expect(() => buffer.at(index)).toThrow(RangeError);
  });

  test("binary-searches the first item matching a monotonic predicate across the wrap point", () => {
    const buffer = new RingBuffer<number>(5);
    for (let value = 1; value <= 8; value++) buffer.push(value * 10);
    // Retained (oldest first): 40, 50, 60, 70, 80 — physically wrapped.
    const probes: number[] = [];
    const firstAbove = (threshold: number) =>
      buffer.findFirstIndex((value) => {
        probes.push(value);
        return value > threshold;
      });

    expect(firstAbove(55)).toBe(2);
    expect(buffer.at(2)).toBe(60);
    // Logarithmic probing, not a scan.
    expect(probes.length).toBeLessThanOrEqual(3);

    expect(firstAbove(0)).toBe(0);
    expect(firstAbove(80)).toBe(buffer.size);
    expect(new RingBuffer<number>(2).findFirstIndex(() => true)).toBe(0);
  });
});
