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
