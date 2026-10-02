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
let fetchMock: jest.SpiedFunction<typeof fetch>;
const response = (body = "") => new Response(body, { status: 200 });
beforeEach(() => {
  fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_, init) => {
      const query = String(init?.body);
      if (query.startsWith("SELECT record"))
        return response(JSON.stringify({ record: JSON.stringify(sample) }));
      if (query.startsWith("SELECT max(sequence)"))
        return response('{"lastSequence":"1"}');
      if (query.startsWith("SELECT minOrNull"))
        return response('{"oldest":"1"}');
      return response();
    });
});
afterEach(() => fetchMock.mockRestore());
it("inherits the APM policy, restores history, batches private-field-free writes and trims storage", async () => {
  const store = await clickHouseApmPersistence(options);
  expect(
    await store.load({ maxSamples: 100, maxStorage: 524288, retentionDays: 7 })
  ).toEqual({ samples: [sample], lastSequence: 1 });
  const before = fetchMock.mock.calls.length;
  store.append({
    ...sample,
    sequence: 2,
    error: "private error",
    correlationId: "private correlation",
  });
  expect(fetchMock).toHaveBeenCalledTimes(before);
  await store.flush();
  const body = String(fetchMock.mock.calls[before][1]?.body);
  expect(body).toContain("INSERT INTO");
  expect(body).not.toContain("private");
  expect(body).toContain(
    new Date(sample.timestampMs + 7 * 86400000)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "")
  );
  expect(
    fetchMock.mock.calls.some(([url]) =>
      String(url).includes("param_bytes=524288")
    )
  ).toBe(true);
  expect(
    fetchMock.mock.calls.some(([, init]) =>
      String(init?.body).includes("TTL expiresAt DELETE")
    )
  ).toBe(true);
  await store.close();
  expect(() => store.append(sample)).toThrow("closed");
});
it("latches background failures without exposing server response bodies", async () => {
  const store = await clickHouseApmPersistence({ ...options, batchSize: 1 });
  fetchMock.mockResolvedValue(
    new Response("secret SQL details", { status: 503 })
  );
  store.append(sample);
  await expect(store.flush()).rejects.toThrow("HTTP 503");
  expect(() => store.append({ ...sample, sequence: 2 })).toThrow("HTTP 503");
  expect(store.status?.().error).toContain("HTTP 503");
  await expect(store.close()).rejects.toThrow("HTTP 503");
});
it("bounds queued and in-flight samples", async () => {
  const store = await clickHouseApmPersistence({
    ...options,
    batchSize: 1,
    maxPendingSamples: 1,
  });
  let finish!: (value: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  store.append(sample);
  expect(() => store.append({ ...sample, sequence: 2 })).toThrow(
    "queue is full"
  );
  const close = store.close();
  finish(response());
  await close;
});
it("rejects unsafe options before making requests", async () => {
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
it("rejects corrupt restoration and invalid retention", async () => {
  const store = await clickHouseApmPersistence(options);
  fetchMock.mockResolvedValue(response('{"record":"{}"}'));
  await expect(store.load({ maxSamples: 100 })).rejects.toThrow();
  await expect(store.load({ maxSamples: 0 })).rejects.toThrow();
  await expect(
    store.load({ maxSamples: 100, cutoffTimestampMs: NaN })
  ).rejects.toThrow();
  await store.close();
});

it("rejects duplicated retention policy on the adapter", async () => {
  await expect(
    clickHouseApmPersistence(Object.assign({}, options, { retentionDays: 7 }))
  ).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
