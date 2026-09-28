import {
  createIdCanonicalizer,
  idsMatch,
} from "../../resources/live/idCanonicalizer";

const KNOWN_IDS = ["app.tasks.server", "app.tasks.worker", "app.events.ready"];

describe("idCanonicalizer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("matches exact ids and dot-namespaced suffixes only", () => {
    expect(idsMatch("app.tasks.server", "app.tasks.server")).toBe(true);
    expect(idsMatch("app.tasks.server", "server")).toBe(true);
    expect(idsMatch("app.tasks.webserver", "server")).toBe(false);
  });

  test("resolves short ids, keeps exact and unknown ids, and maps empty input to null", () => {
    const canonicalize = createIdCanonicalizer(KNOWN_IDS);

    expect(canonicalize("server")).toBe("app.tasks.server");
    expect(canonicalize("app.tasks.worker")).toBe("app.tasks.worker");
    expect(canonicalize("unknown-source")).toBe("unknown-source");
    expect(canonicalize(null)).toBeNull();
    expect(canonicalize(undefined)).toBeNull();
    expect(canonicalize("")).toBeNull();
  });

  test("memoizes lookups so repeated ids skip the candidate scan", () => {
    const canonicalize = createIdCanonicalizer(KNOWN_IDS);
    const endsWith = jest.spyOn(String.prototype, "endsWith");

    // Counts are read right after each call so no assertion code runs in
    // between and pollutes the spy.
    const first = canonicalize("worker");
    const callsAfterFirst = endsWith.mock.calls.length;
    const second = canonicalize("worker");
    const callsAfterSecond = endsWith.mock.calls.length;

    expect(first).toBe("app.tasks.worker");
    expect(second).toBe("app.tasks.worker");
    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  test("bounds the memo so arbitrary ids cannot grow it without limit", () => {
    const canonicalize = createIdCanonicalizer(KNOWN_IDS, 2);
    const endsWith = jest.spyOn(String.prototype, "endsWith");

    canonicalize("server");
    canonicalize("worker");
    // The third distinct id resets the full memo...
    canonicalize("ready");
    const callsBeforeRepeat = endsWith.mock.calls.length;
    // ...so an id evicted by that reset is resolved again.
    const repeated = canonicalize("server");
    const callsAfterRepeat = endsWith.mock.calls.length;

    expect(repeated).toBe("app.tasks.server");
    expect(callsAfterRepeat).toBeGreaterThan(callsBeforeRepeat);
  });

  test("snapshots the candidate ids so memoized answers never go stale", () => {
    const ids = [...KNOWN_IDS];
    const canonicalize = createIdCanonicalizer(ids);

    ids.push("app.tasks.late");

    expect(canonicalize("late")).toBe("late");
  });
});
