import { ApiError, createLiveApi } from "./api";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test("scopes cursor requests to the selected runtime using existing browser authentication", async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      executions: [],
      nextCursor: null,
      hasMore: false,
      nextOffset: null,
    }),
  });
  global.fetch = fetchMock;
  await createLiveApi("orders/runtime").listExecutionPage({
    cursor: "page-2",
    limit: 40,
  });
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.pathname).toBe("/durable/api/executions");
  expect(url.searchParams.get("runtimeId")).toBe("orders/runtime");
  expect(url.searchParams.get("cursor")).toBe("page-2");
  expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
});

test("preserves server validation errors for operator feedback", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ error: "Invalid workflow input" }),
  });
  await expect(
    createLiveApi("orders").startExecution("fulfill", {})
  ).rejects.toEqual(new ApiError(400, "Invalid workflow input"));
});

test("aborts detail reads and discards late results when leaving an execution", async () => {
  let resolveResponse: ((value: unknown) => void) | undefined;
  const fetchMock = jest.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
  );
  global.fetch = fetchMock;
  const onDetail = jest.fn();
  const stop = createLiveApi("orders").subscribeExecution(
    "old-execution",
    onDetail
  );
  stop();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  resolveResponse?.({
    ok: true,
    json: async () => ({ execution: { id: "old-execution" } }),
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(onDetail).not.toHaveBeenCalled();
});

test.each(["response", "body"])(
  "aborts stalled read %s after the deadline and permits a fresh retry",
  async (phase) => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockImplementation((_url: URL, options: RequestInit) => {
        const stalled = new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });
        return phase === "response"
          ? stalled
          : Promise.resolve({ ok: true, json: () => stalled });
      });
    global.fetch = fetchMock;
    const api = createLiveApi("orders");
    const result = api.listSchedules().catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await result).toEqual(
      new ApiError(408, "Read request timed out after 30 seconds. Try again.")
    );
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ schedules: [] }) });
    await expect(api.listSchedules()).resolves.toEqual([]);
  }
);

test("does not time out mutating requests or leave read deadlines after completion", async () => {
  jest.useFakeTimers();
  let finish!: (value: unknown) => void;
  const fetchMock = jest.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  global.fetch = fetchMock;
  const pending = createLiveApi("orders").startExecution("fulfill", {});
  expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  await jest.advanceTimersByTimeAsync(60_000);
  finish({ ok: true, json: async () => ({ executionId: "created" }) });
  await expect(pending).resolves.toBe("created");
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ schedules: [] }) });
  await createLiveApi("orders").listSchedules();
  expect(jest.getTimerCount()).toBe(0);
});
