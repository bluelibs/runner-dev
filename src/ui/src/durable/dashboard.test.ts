import { buildDashboardModel, filterDashboardExecutions } from "./dashboard";
import { filterWorkflows } from "./workflowCatalog";
import { execution, schedule, timestamp, workflow } from "./__tests__/fixtures";

test("counts live, failed and cancelled runs separately and excludes future activity", () => {
  const executions = [
    execution({ id: "done", status: "completed" }),
    execution({ id: "failed", status: "failed" }),
    execution({ id: "compensation", status: "compensation_failed" }),
    execution({ id: "cancelled", status: "cancelled" }),
    execution({ id: "sleeping", status: "sleeping" }),
    execution({ id: "future", createdAt: "2026-10-08T10:01:00.000Z" }),
    execution({ id: "old", createdAt: "2026-10-07T10:00:00.000Z" }),
  ];
  const model = buildDashboardModel({
    executions,
    schedules: [schedule(), schedule({ id: "paused", status: "paused" })],
    stuck: [executions[1]],
    workflows: [workflow, { ...workflow, key: "empty", title: "Unused" }],
    nowMs: Date.parse(timestamp),
  });
  expect(model.metrics).toEqual({
    total: 7,
    live: 3,
    completed: 1,
    failed: 2,
    cancelled: 1,
    stuck: 1,
    successRate: 25,
    activeSchedules: 1,
    pausedSchedules: 1,
  });
  expect(
    model.activity.reduce((count, bucket) => count + bucket.total, 0)
  ).toBe(5);
  expect(model.activity.at(-1)).toMatchObject({
    total: 5,
    completed: 1,
    failed: 2,
    live: 1,
  });
  expect(model.workflowHealth).toEqual([
    {
      key: "orders",
      title: workflow.title,
      total: 7,
      live: 3,
      failed: 2,
      successRate: 25,
    },
    {
      key: "empty",
      title: "Unused",
      total: 0,
      live: 0,
      failed: 0,
      successRate: 100,
    },
  ]);
  expect(model.insights.map((item) => item.title)).toEqual([
    "2 failed executions",
    "1 execution is stuck",
    "1 paused schedule",
  ]);
});

test("reports quiet and healthy states when no executions have finished", () => {
  const build = (executions: ReturnType<typeof execution>[]) =>
    buildDashboardModel({
      executions,
      schedules: [],
      stuck: [],
      workflows: [workflow],
      nowMs: Date.parse(timestamp),
    });
  expect(build([]).metrics.successRate).toBe(100);
  expect(build([]).insights.map((item) => item.title)).toEqual([
    "No failures in view",
    "Runtime is quiet",
    "0 active schedules",
  ]);
  expect(build([execution()]).insights[1]).toMatchObject({
    tone: "info",
    title: "1 moving now",
  });
});

test("filters status and workflow before searching execution metadata and sorting", () => {
  const rows = [
    execution({ id: "older", status: "sleeping", attempt: 2 }),
    execution({ id: "newer", updatedAt: "2026-10-08T11:00:00.000Z" }),
    execution({ id: "failed", status: "failed" }),
    execution({ id: "other", workflowKey: "billing" }),
  ];
  const filter = (
    query = "",
    status: "all" | "live" | "failed" = "all",
    workflowKey: string | null = null
  ) =>
    filterDashboardExecutions(rows, { query, status, workflowKey }).map(
      (row) => row.id
    );
  expect(filter("", "live", "orders")).toEqual(["newer", "older"]);
  expect(filter("", "failed")).toEqual(["failed"]);
  expect(filter(" ATTEMPT 2 ")).toEqual(["older"]);
  expect(filter("payment")).toHaveLength(4);
  expect(filter("missing")).toEqual([]);
});

test("searches workflow descriptions and categories without changing empty searches", () => {
  const workflows = [
    workflow,
    {
      ...workflow,
      key: "billing",
      category: "Finance",
      description: "Issue invoices",
    },
  ];
  expect(filterWorkflows(workflows, " ")).toBe(workflows);
  expect(filterWorkflows(workflows, " FINANCE ")).toEqual([workflows[1]]);
  expect(filterWorkflows(workflows, "ship paid")).toEqual([workflow]);
  expect(filterWorkflows(workflows, "missing")).toEqual([]);
});
