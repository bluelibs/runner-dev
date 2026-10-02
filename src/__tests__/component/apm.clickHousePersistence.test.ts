import { clickHouseApmPersistence } from "../../resources/live/clickHouseApmPersistence";
import type { RunRecord } from "../../resources/live/types";

const sample: RunRecord = {
  sequence: 1,
  timestampMs: Date.now(),
  nodeId: "checkout",
  nodeKind: "TASK",
  ok: false,
  durationMs: 12,
  parentId: null,
};
const options = {
  url: "http://localhost:8123",
  streamId: "test-runtime",
  batchSize: 2,
  flushIntervalMs: 60_000,
};
const response = (body = "") => new Response(body, { status: 200 });
let fetchMock: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => {
  fetchMock.mockRestore();
});

it("initializes TTL storage, restores a bounded history and batches writes", async () => {
  fetchMock.mockResolvedValueOnce(response());
  fetchMock.mockResolvedValueOnce(
    response(JSON.stringify({ record: JSON.stringify(sample) }))
  );
  fetchMock.mockResolvedValueOnce(response('{"lastSequence":"1"}'));
  fetchMock.mockResolvedValue(response());
  const store = await clickHouseApmPersistence(options);
  expect(
    await store.load({
      maxSamples: 100,
      cutoffTimestampMs: sample.timestampMs - 100,
    })
  ).toEqual({ samples: [sample], lastSequence: 1 });
  store.append({
    ...sample,
    sequence: 2,
    error: "private error",
    correlationId: "private correlation",
  });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await store.flush();
  expect(fetchMock.mock.calls[3][1]?.body).toContain("INSERT INTO");
  expect(fetchMock.mock.calls[3][1]?.body).not.toContain("private");
  const url = fetchMock.mock.calls[1][0];
  expect(String(url)).toContain("param_limit=100");
  expect(String(fetchMock.mock.calls[0][1]?.body)).toContain(
    "TTL completedAt + INTERVAL 30 DAY DELETE"
  );
  await store.close();
  expect(() => store.append(sample)).toThrow("closed");
});

it("latches background failures and surfaces them without server response bodies", async () => {
  fetchMock.mockResolvedValueOnce(response());
  fetchMock.mockResolvedValue(
    new Response("secret SQL details", { status: 503 })
  );
  const store = await clickHouseApmPersistence({ ...options, batchSize: 1 });
  store.append(sample);
  await expect(store.flush()).rejects.toThrow("HTTP 503");
  expect(() => store.append({ ...sample, sequence: 2 })).toThrow("HTTP 503");
  expect(store.status?.().error).toContain("HTTP 503");
  await expect(store.close()).rejects.toThrow("HTTP 503");
});

it("bounds queued and in-flight samples and flushes on disposal", async () => {
  fetchMock.mockResolvedValueOnce(response());
  let finish!: (value: Response) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const store = await clickHouseApmPersistence({
    ...options,
    batchSize: 1,
    maxPendingSamples: 1,
  });
  store.append(sample);
  expect(() => store.append({ ...sample, sequence: 2 })).toThrow(
    "queue is full"
  );
  const close = store.close();
  finish(response());
  await close;
});

it("rejects unsafe identifiers, credentials in URLs and invalid queue settings before requests", async () => {
  await expect(
    clickHouseApmPersistence({ ...options, table: "x; DROP TABLE x" })
  ).rejects.toThrow();
  await expect(
    clickHouseApmPersistence({
      ...options,
      url: "http://user:pass@localhost:8123",
    })
  ).rejects.toThrow("without credentials");
  await expect(
    clickHouseApmPersistence({ ...options, maxPendingSamples: 1 })
  ).rejects.toThrow("at least batchSize");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects corrupted restoration and expired date cursors", async () => {
  fetchMock.mockResolvedValueOnce(response());
  fetchMock.mockResolvedValue(response('{"record":"{}"}'));
  const store = await clickHouseApmPersistence(options);
  await expect(store.load({ maxSamples: 100 })).rejects.toThrow();
  await expect(store.load({ maxSamples: 0 })).rejects.toThrow();
  await expect(
    store.load({ maxSamples: 100, cutoffTimestampMs: NaN })
  ).rejects.toThrow();
  await store.close();
});
