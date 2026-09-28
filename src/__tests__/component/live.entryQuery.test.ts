import { RingBuffer } from "../../resources/live/RingBuffer";
import { queryEntries, toQueryOptions } from "../../resources/live/entryQuery";
import { createSequenceClock } from "../../resources/live/sequenceClock";
import type { LiveEntryStamp } from "../../resources/live.resource";

interface TestEntry extends LiveEntryStamp {
  label: string;
}

/** Entries 1..count; timestamps repeat in pairs to mimic same-ms bursts. */
function bufferOf(count: number, capacity = count): RingBuffer<TestEntry> {
  const buffer = new RingBuffer<TestEntry>(capacity);
  for (let sequence = 1; sequence <= count; sequence++) {
    buffer.push({
      sequence,
      timestampMs: 100 + Math.ceil(sequence / 2),
      label: `e${sequence}`,
    });
  }
  return buffer;
}

const everything = () => true;
const labels = (entries: TestEntry[]) => entries.map((entry) => entry.label);

describe("toQueryOptions", () => {
  test("treats a bare number as a timestamp cursor", () => {
    expect(toQueryOptions(42)).toEqual({ afterTimestamp: 42 });
    expect(toQueryOptions(undefined)).toEqual({});
    const options = { afterSequence: 7, last: 3 };
    expect(toQueryOptions(options)).toBe(options);
  });
});

describe("queryEntries", () => {
  test("returns every match oldest-first without a window", () => {
    expect(labels(queryEntries(bufferOf(4), {}, everything))).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
    ]);
  });

  test("without a cursor, `last` keeps the most recent N matches", () => {
    const odd = (entry: TestEntry) => entry.sequence % 2 === 1;
    expect(labels(queryEntries(bufferOf(8), { last: 2 }, odd))).toEqual([
      "e5",
      "e7",
    ]);
  });

  test("with a sequence cursor, `last` pages forward oldest-first", () => {
    const buffer = bufferOf(8);
    expect(
      labels(queryEntries(buffer, { afterSequence: 3, last: 2 }, everything))
    ).toEqual(["e4", "e5"]);
    expect(
      labels(queryEntries(buffer, { afterSequence: 8, last: 2 }, everything))
    ).toEqual([]);
  });

  test("with a timestamp cursor, `last` pages forward oldest-first", () => {
    // Timestamps: e1,e2 → 101; e3,e4 → 102; e5,e6 → 103 ...
    expect(
      labels(
        queryEntries(bufferOf(8), { afterTimestamp: 101, last: 3 }, everything)
      )
    ).toEqual(["e3", "e4", "e5"]);
  });

  test("combines both cursors", () => {
    expect(
      labels(
        queryEntries(
          bufferOf(8),
          { afterSequence: 1, afterTimestamp: 102 },
          everything
        )
      )
    ).toEqual(["e5", "e6", "e7", "e8"]);
  });

  test("sequence paging never loses entries sharing a timestamp at a page cut", () => {
    const buffer = bufferOf(9);
    const seen: string[] = [];
    let cursor = 0;
    for (;;) {
      const page = queryEntries(
        buffer,
        { afterSequence: cursor, last: 3 },
        everything
      );
      if (page.length === 0) break;
      seen.push(...labels(page));
      cursor = page[page.length - 1].sequence;
    }
    expect(seen).toEqual(labels(queryEntries(buffer, {}, everything)));
  });

  test("returns nothing for non-positive windows and truncates fractional ones", () => {
    const buffer = bufferOf(4);
    expect(queryEntries(buffer, { last: 0 }, everything)).toEqual([]);
    expect(queryEntries(buffer, { last: -2 }, everything)).toEqual([]);
    expect(queryEntries(buffer, { last: 0.5 }, everything)).toEqual([]);
    expect(labels(queryEntries(buffer, { last: 2.9 }, everything))).toEqual([
      "e3",
      "e4",
    ]);
  });

  test("seeks past the cursor instead of filtering the whole buffer", () => {
    // Wrapped buffer: sequences 1..6 were evicted, 7..16 remain.
    const buffer = bufferOf(16, 10);
    const matches = jest.fn(everything);

    const tail = queryEntries(buffer, { afterSequence: 13 }, matches);

    expect(labels(tail)).toEqual(["e14", "e15", "e16"]);
    // Only the tail after the cursor is inspected.
    expect(matches).toHaveBeenCalledTimes(3);

    // A cursor older than everything retained starts at the oldest entry.
    expect(
      labels(queryEntries(buffer, { afterSequence: 2, last: 2 }, everything))
    ).toEqual(["e7", "e8"]);
  });

  test("stops inspecting entries once a cursor page is full", () => {
    const matches = jest.fn(everything);
    queryEntries(bufferOf(100), { afterSequence: 0, last: 5 }, matches);
    expect(matches).toHaveBeenCalledTimes(5);
  });
});

describe("createSequenceClock", () => {
  test("stays strictly increasing within one millisecond and across clock rewinds", () => {
    const nextSequence = createSequenceClock();
    const sameMillisecond = [1_000, 1_000, 1_000].map(nextSequence);
    const afterRewind = nextSequence(900);

    expect(sameMillisecond).toEqual([1_000_000, 1_000_001, 1_000_002]);
    expect(afterRewind).toBe(1_000_003);
  });

  test("a restarted clock keeps counting above the previous run", () => {
    const previousRun = createSequenceClock();
    let lastOfPreviousRun = 0;
    for (let i = 0; i < 500; i++) lastOfPreviousRun = previousRun(5_000);

    // A process restart one millisecond later.
    const restartedRun = createSequenceClock();
    expect(restartedRun(5_001)).toBeGreaterThan(lastOfPreviousRun);
  });
});
