import { clickHouseHistory } from "../../resources/live/remote/clickhouse";
import {
  remoteHistory,
  type StoredSlot,
} from "../../resources/live/remote/store";
import type { LivePersistedEntry } from "../../resources/live/persistence";

test("remote history keeps bounded snapshots through ring rotation, resize, empty retention and restart", async () => {
  const slots = new Map<string, string>();
  const open = () =>
    remoteHistory({
      async read() {
        return [...slots].map(([slot, record]) => ({ slot, record }));
      },
      async commit(changes: StoredSlot[]) {
        for (const { slot, record } of changes)
          if (record) slots.set(slot, record);
          else slots.delete(slot);
      },
      async close() {},
    });
  const expected: LivePersistedEntry[] = [];
  let sequence = 0;
  for (const capacity of [4, 4, 5, 2, 7, 1, 0, 3]) {
    const store = open();
    const options = { maxEntries: capacity };
    const history = await store.load(options);
    function trim() {
      for (const kind of ["log", "error"]) {
        const older = expected.filter((row) => row.kind === kind);
        for (const old of older.slice(0, Math.max(0, older.length - capacity)))
          expected.splice(expected.indexOf(old), 1);
      }
    }
    trim();
    expect(history).toEqual({ lastSequence: sequence, entries: expected });
    for (let i = 0; i < 13; i++) {
      sequence++;
      const record: LivePersistedEntry =
        i % 3 === 0
          ? {
              kind: "error",
              entry: {
                timestampMs: 0,
                sequence,
                sourceKind: "TASK",
                sourceId: "test",
                message: "failed",
              },
            }
          : {
              kind: "log",
              entry: {
                timestampMs: 0,
                sequence,
                level: "info",
                message: "hello",
                data: { counter: i },
              },
            };
      store.append(record, options);
      expected.push(structuredClone(record));
      record.entry.message = "mutated after append";
      trim();
    }
    await store.close();
    expect(slots.size).toBeLessThanOrEqual(1 + 2 * capacity);
  }
});

test("a failed batch latches and close still releases the connection", async () => {
  const close = jest.fn(async () => {});
  const store = remoteHistory({
    read: async () => [],
    commit: async () => {
      throw new Error("write failed");
    },
    close,
  });
  const record: LivePersistedEntry = {
    kind: "log",
    entry: { timestampMs: 0, sequence: 1, level: "info", message: "hello" },
  };
  const options = { maxEntries: 1 };
  expect(() => store.append(record, options)).toThrow(/Load live history/);
  await store.load(options);
  store.append(record, options);
  await expect(store.flush()).rejects.toThrow("write failed");
  expect(store.status?.().error).toBe("write failed");
  expect(() => store.append(record, options)).toThrow("write failed");
  await expect(store.close()).rejects.toThrow("write failed");
  expect(close).toHaveBeenCalled();
});

test("ClickHouse rejects a stale writer before it can overwrite newer history slots", async () => {
  let revision = 0;
  let inserts = 0;
  const fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_url, init) => {
      const sql = String(init?.body);
      if (sql.startsWith("SELECT max(revision)"))
        return new Response(String(revision));
      if (sql.startsWith("INSERT")) {
        revision++;
        inserts++;
      }
      return new Response("");
    });
  try {
    const options = { maxEntries: 10 };
    const connection = { url: "http://localhost:8123", streamId: "test" };
    const first = await clickHouseHistory(connection);
    const stale = await clickHouseHistory(connection);
    await Promise.all([first.load(options), stale.load(options)]);
    const record: LivePersistedEntry = {
      kind: "log",
      entry: { sequence: 1, timestampMs: 1, level: "info", message: "test" },
    };
    first.append(record, options);
    await first.close();
    stale.append(record, options);
    await expect(stale.close()).rejects.toThrow("another writer");
    expect(inserts).toBe(1);
  } finally {
    fetchMock.mockRestore();
  }
});
