import { ApiError, createLiveApi } from "./api";
import {
  execution,
  executionDetail,
  schedule,
  workflow,
} from "./__tests__/fixtures";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test("reads runtime-scoped catalogs, details, schedules and recovery reports", async () => {
  const detail = executionDetail();
  const rows = [execution()];
  const schedules = [schedule()];
  const report = {
    scannedCount: 4,
    recoveredCount: 2,
    skippedCount: 1,
    failedCount: 1,
  };
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const api = createLiveApi("orders/runtime");
  const respond = (body: unknown) =>
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  respond({ workflows: [workflow], nextCursor: "next", hasMore: true });
  expect(
    await api.listWorkflowPage({
      query: "Paid orders",
      cursor: "page/2",
      limit: 10,
    })
  ).toMatchObject({ workflows: [workflow] });
  let url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    query: "Paid orders",
    cursor: "page/2",
    limit: "10",
    runtimeId: "orders/runtime",
  });
  respond({ workflows: [workflow] });
  expect(await api.listWorkflows()).toEqual([workflow]);
  respond({ workflow });
  expect(await api.getWorkflow("app/orders")).toEqual(workflow);
  expect(new URL(String(fetchMock.mock.calls.at(-1)?.[0])).pathname).toBe(
    "/durable/api/workflows/app%2Forders"
  );
  respond({ executions: rows, hasMore: false, nextOffset: null });
  expect(
    await api.listExecutions({
      workflowKey: "orders",
      status: "live",
      executionId: "run/1",
      offset: 0,
    })
  ).toEqual(rows);
  url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({
    workflowKey: "orders",
    status: "live",
    limit: "100",
    offset: "0",
    executionId: "run/1",
    runtimeId: "orders/runtime",
  });
  respond({ execution: detail });
  expect(await api.getExecution("run/1")).toEqual(detail);
  expect(new URL(String(fetchMock.mock.calls.at(-1)?.[0])).pathname).toBe(
    "/durable/api/executions/run%2F1"
  );
  respond({ schedules });
  expect(await api.listSchedules()).toEqual(schedules);
  respond({ executions: rows });
  expect(await api.listStuck()).toEqual(rows);
  respond({ report });
  expect(await api.recover()).toEqual(report);
  expect(fetchMock.mock.calls.at(-1)?.[1]).toEqual({
    method: "POST",
    headers: undefined,
    body: undefined,
  });
});

test("encodes execution identities and sends JSON only when the operation has a payload", async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ executionId: "new-run" }),
  });
  global.fetch = fetchMock;
  const api = createLiveApi("runtime-1");
  const cases: Array<{
    run: () => Promise<unknown>;
    path: string;
    body?: unknown;
  }> = [
    {
      run: () => api.startExecution("orders", { id: 1 }),
      path: "/executions",
      body: { workflow: "orders", input: { id: 1 } },
    },
    {
      run: () => api.sendSignal("run/1", "paid", { amount: 5 }),
      path: "/executions/run%2F1/signals",
      body: { signal: "paid", payload: { amount: 5 } },
    },
    {
      run: () => api.cancelExecution("run/1"),
      path: "/executions/run%2F1/cancel",
    },
    {
      run: () => api.retryExecution("run/1"),
      path: "/executions/run%2F1/retry",
    },
    {
      run: () => api.pauseExecution("run/1"),
      path: "/executions/run%2F1/pause",
    },
    {
      run: () => api.resumeExecution("run/1"),
      path: "/executions/run%2F1/resume",
    },
    {
      run: () => api.restartExecution("run/1"),
      path: "/executions/run%2F1/restart",
    },
    {
      run: () => api.restartExecution("run/1", { changed: true }),
      path: "/executions/run%2F1/restart",
      body: { input: { changed: true } },
    },
    {
      run: () => api.forceFailExecution("run/1", "operator decision"),
      path: "/executions/run%2F1/force-fail",
      body: { reason: "operator decision" },
    },
    {
      run: () => api.skipStep("run/1", "payment", "already paid"),
      path: "/executions/run%2F1/skip-step",
      body: { stepId: "payment", reason: "already paid" },
    },
    {
      run: () => api.editState("run/1", "payment", { paid: true }, "repair"),
      path: "/executions/run%2F1/edit-state",
      body: { stepId: "payment", result: { paid: true }, reason: "repair" },
    },
  ];
  for (const { run, path, body } of cases) {
    const result = await run();
    const [requestUrl, options] = fetchMock.mock.calls.at(-1)!;
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe(`/durable/api${path}`);
    expect(url.searchParams.get("runtimeId")).toBe("runtime-1");
    expect(options).toEqual({
      method: "POST",
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (path === "/executions" || path.endsWith("/restart"))
      expect(result).toBe("new-run");
  }
});

test("uses the schedule REST methods and unwraps creation and preview responses", async () => {
  const fires = ["2026-10-08T10:01:00.000Z"];
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ scheduleId: "schedule/1", fires }),
  });
  global.fetch = fetchMock;
  const api = createLiveApi("runtime-1");
  const body = { workflow: "orders", interval: 60000 };
  expect(await api.createSchedule(body)).toBe("schedule/1");
  expect(await api.previewSchedule(body)).toEqual(fires);
  await api.updateSchedule("schedule/1", body);
  await api.pauseSchedule("schedule/1");
  await api.resumeSchedule("schedule/1");
  await api.removeSchedule("schedule/1");
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      new URL(String(url)).pathname,
      options.method,
      options.body,
    ])
  ).toEqual([
    ["/durable/api/schedules", "POST", JSON.stringify(body)],
    ["/durable/api/schedules/preview", "POST", JSON.stringify(body)],
    ["/durable/api/schedules/schedule%2F1", "PATCH", JSON.stringify(body)],
    ["/durable/api/schedules/schedule%2F1/pause", "POST", undefined],
    ["/durable/api/schedules/schedule%2F1/resume", "POST", undefined],
    ["/durable/api/schedules/schedule%2F1", "DELETE", undefined],
  ]);
});

test("falls back to the HTTP status text when errors contain no message", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 502,
    statusText: "Bad Gateway",
    json: async () => ({}),
  });
  await expect(createLiveApi("runtime-1").listWorkflowPage()).rejects.toEqual(
    new ApiError(502, "Bad Gateway")
  );
});

test("polls details, reports transient errors and cancels future reads on unsubscribe", async () => {
  jest.useFakeTimers();
  const detail = executionDetail();
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Unavailable",
      json: async () => ({}),
    })
    .mockResolvedValue({ ok: true, json: async () => ({ execution: detail }) });
  global.fetch = fetchMock;
  const onDetail = jest.fn();
  const onError = jest.fn();
  const stop = createLiveApi("runtime/1").subscribeExecution(
    "run/1",
    onDetail,
    onError
  );
  await jest.advanceTimersByTimeAsync(0);
  expect(onError).toHaveBeenCalledWith(new ApiError(503, "Unavailable"));
  await jest.advanceTimersByTimeAsync(2000);
  expect(onDetail).toHaveBeenCalledWith(detail);
  expect(
    new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("runtimeId")
  ).toBe("runtime/1");
  stop();
  await jest.advanceTimersByTimeAsync(4000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
});
