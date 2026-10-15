import type { StudioExecutionPage } from "../../../durable/shared/types";
import { ExecutionPager } from "./executionPager";
import { mergeExecutions } from "./executionFeed";
import { execution } from "./__tests__/fixtures";

function page(index: number): StudioExecutionPage {
  return {
    executions: [execution({ id: `run-${index}` })],
    hasMore: index < 12,
    nextCursor: index < 12 ? String(index + 1) : null,
    nextOffset: null,
    total: 13,
  };
}

test("bounds cached history, restores previous pages and freezes polling while browsing", async () => {
  const listExecutionPage = jest.fn(async ({ cursor }: { cursor?: string }) =>
    page(Number(cursor ?? 0))
  );
  const changed = jest.fn();
  const onError = jest.fn();
  const pager = new ExecutionPager(
    { listExecutionPage },
    { status: "failed", workflowKey: "orders" },
    changed,
    onError
  );
  await pager.loadMore();
  await pager.loadPrevious();
  expect(listExecutionPage).not.toHaveBeenCalled();
  await pager.refreshHead();
  expect(listExecutionPage).toHaveBeenLastCalledWith({
    status: "failed",
    workflowKey: "orders",
    limit: 40,
    cursor: undefined,
  });
  await pager.poll();
  for (let index = 0; index < 11; index++) await pager.loadMore();
  expect(pager.snapshot).toMatchObject({
    startOffset: 80,
    hasPrevious: true,
    hasMore: true,
    totalCount: 13,
  });
  expect(pager.snapshot.executions.map((row) => row.id)).toEqual(
    Array.from({ length: 10 }, (_, index) => `run-${index + 2}`)
  );
  const calls = listExecutionPage.mock.calls.length;
  await pager.poll();
  expect(listExecutionPage).toHaveBeenCalledTimes(calls);
  await pager.loadPrevious();
  expect(pager.snapshot.startOffset).toBe(40);
  expect(pager.snapshot.executions[0].id).toBe("run-1");
  await pager.refreshHead();
  expect(pager.snapshot).toMatchObject({ startOffset: 0, hasPrevious: false });
  expect(pager.snapshot.executions).toHaveLength(1);
  expect(onError).not.toHaveBeenCalled();
});

test("rejects a non-advancing cursor, retains visible rows and permits retry", async () => {
  const listExecutionPage = jest
    .fn()
    .mockResolvedValueOnce(page(0))
    .mockResolvedValueOnce({ ...page(1), nextCursor: "1" })
    .mockResolvedValueOnce(page(1));
  const onError = jest.fn();
  const pager = new ExecutionPager(
    { listExecutionPage },
    {},
    jest.fn(),
    onError
  );
  await pager.refreshHead();
  await pager.loadMore();
  expect(pager.snapshot.error).toBe("Execution cursor did not advance.");
  expect(pager.snapshot.executions.map((row) => row.id)).toEqual(["run-0"]);
  expect(onError).toHaveBeenCalledWith(
    new Error("Execution cursor did not advance.")
  );
  await pager.loadMore();
  expect(pager.snapshot.error).toBeNull();
  expect(pager.snapshot.executions).toHaveLength(2);
});

test("ignores concurrent requests and responses received after disposal", async () => {
  let resolvePage: (value: StudioExecutionPage) => void = () => {
    throw new Error("Request has not started");
  };
  const listExecutionPage = jest.fn(
    () =>
      new Promise<StudioExecutionPage>((resolve) => {
        resolvePage = resolve;
      })
  );
  const changed = jest.fn();
  const pager = new ExecutionPager(
    { listExecutionPage },
    {},
    changed,
    jest.fn()
  );
  const pending = pager.refreshHead();
  await pager.refreshHead();
  expect(listExecutionPage).toHaveBeenCalledTimes(1);
  expect(pager.snapshot.loading).toBe(true);
  pager.dispose();
  changed.mockClear();
  resolvePage(page(0));
  await pending;
  await pager.loadMore();
  expect(changed).not.toHaveBeenCalled();
});

test("reports request errors and stops loading at the end of history", async () => {
  const listExecutionPage = jest
    .fn()
    .mockRejectedValueOnce("offline")
    .mockResolvedValueOnce(page(12));
  const pager = new ExecutionPager(
    { listExecutionPage },
    {},
    jest.fn(),
    jest.fn()
  );
  await pager.refreshHead();
  expect(pager.snapshot).toMatchObject({
    loading: false,
    error: "Could not load executions.",
  });
  await pager.refreshHead();
  await pager.loadMore();
  expect(listExecutionPage).toHaveBeenCalledTimes(2);
  expect(pager.snapshot).toMatchObject({ hasMore: false, error: null });
});

test("updates exact execution identities and maintains stable chronological ordering", () => {
  const current = [execution({ id: "b" }), execution({ id: "a" })];
  const incoming = [
    execution({ id: "b", status: "completed" }),
    execution({ id: "new", createdAt: "2026-10-08T11:00:00.000Z" }),
  ];
  expect(
    mergeExecutions(current, incoming).map((row) => [row.id, row.status])
  ).toEqual([
    ["new", "running"],
    ["a", "running"],
    ["b", "completed"],
  ]);
  expect(current[0].status).toBe("running");
});
