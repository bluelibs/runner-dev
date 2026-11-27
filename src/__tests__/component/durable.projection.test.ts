import {
  computeResettableSteps,
  formatRetention,
  observedTimeline,
  toSummary,
} from "../../durable/projection";
import type { DashboardRuntime } from "../../durable/runtime";
import {
  ExecutionStatus,
  type DurableHistoryEntry,
  type Execution,
  type StepResult,
} from "@bluelibs/runner/node";

const at = new Date("2026-10-03T00:00:00Z");
const execution: Execution = {
  id: "run",
  workflowKey: "workflow",
  input: {},
  status: ExecutionStatus.Running,
  attempt: 1,
  maxAttempts: 1,
  createdAt: at,
  updatedAt: at,
};
function step(stepId: string, result: unknown): StepResult {
  return { executionId: "run", stepId, result, completedAt: at };
}

test("ordinary business results cannot masquerade as durable wait markers", () => {
  const nodes = observedTimeline(execution, [
    step("business-state", { state: "waiting", signalId: "irrelevant" }),
  ]);
  expect(nodes[0].state).toBe("completed");
  expect(nodes[0].wait).toBeNull();
  expect(nodes[0].result).toEqual({ state: "waiting", signalId: "irrelevant" });
});

test("persisted internal waits retain their signal state", () => {
  const nodes = observedTimeline(execution, [
    step("__signal:approval", { state: "waiting", signalId: "approval" }),
  ]);
  expect(nodes[0].kind).toBe("signal");
  expect(nodes[0].state).toBe("waiting");
  expect(nodes[0].wait?.signalId).toBe("approval");
});

test("uses ordered history entries for command state snapshots, nesting, continuations and resettable boundaries", () => {
  const recordedExecution: Execution = {
    ...execution,
    status: ExecutionStatus.Paused,
    workflowVersion: 2,
    historyRecorded: true,
    resetFromExecutionId: "source-run",
    resetBeforeStep: "settle",
    resetReason: "Manual retry",
  };
  const history: DurableHistoryEntry[] = [
    {
      stepId: "__origin",
      kind: "origin",
      startedOrder: 0,
      completedOrder: 0,
      stateAfter: { value: { stage: "init" } },
    },
    {
      stepId: "validate",
      kind: "step",
      startedOrder: 1,
      completedOrder: 1,
    },
    {
      stepId: "__state:stage",
      kind: "state",
      startedOrder: 2,
      completedOrder: 2,
      stateAfter: { value: { stage: "validated" } },
    },
    {
      stepId: "parallel-work",
      kind: "step",
      startedOrder: 3,
      completedOrder: 5,
    },
    {
      stepId: "nested-child",
      kind: "workflow",
      parentStepId: "parallel-work",
      taskKey: "shipment",
      workflowVersion: 3,
      startedOrder: 4,
      completedOrder: 4,
    },
    {
      stepId: "__command:cmd-1",
      kind: "command",
      startedOrder: 6,
      completedOrder: 6,
      stateAfter: { value: { city: "Vienna" } },
    },
    {
      stepId: "__continue",
      kind: "continue",
      startedOrder: 7,
      completedOrder: 7,
    },
  ];
  expect(computeResettableSteps(history)).toEqual([
    "validate",
    "__state:stage",
    "parallel-work",
    "__continue",
  ]);
  const nodes = observedTimeline(
    recordedExecution,
    [step("validate", { ok: true })],
    history
  );
  expect(nodes.map((node) => node.kind)).toEqual([
    "step",
    "state",
    "step",
    "child",
    "command",
    "continue",
  ]);
  expect(nodes[0].resettable).toBe(true);
  expect(nodes[1].result).toEqual({ stage: "validated" });
  expect(nodes[3]).toMatchObject({
    parentStepId: "parallel-work",
    taskKey: "shipment",
    workflowVersion: 3,
  });
  expect(nodes[3].resettable).toBeUndefined();
  expect(nodes[4].result).toEqual({ city: "Vienna" });
  expect(nodes[4].resettable).toBeUndefined();

  const runtimeStub = {
    workflows: new Map(),
    workflowVersions: new Map([
      [
        "workflow",
        [{ version: 2, task: { id: "wf.v2", meta: { title: "Workflow v2" } } }],
      ],
    ]),
  } as unknown as DashboardRuntime;
  expect(toSummary(runtimeStub, recordedExecution)).toMatchObject({
    workflowTitle: "Workflow v2",
    workflowVersion: 2,
    resetFromExecutionId: "source-run",
    resetBeforeStep: "settle",
    resetReason: "Manual retry",
  });
  expect(
    formatRetention(
      { onComplete: "delete", receipts: { afterMs: 3600_000 } },
      at
    )
  ).toEqual({
    onComplete: "delete",
    receipts: { afterMs: 3600_000 },
    historyCollectAt: at.toISOString(),
    receiptExpireAt: new Date(at.getTime() + 3600_000).toISOString(),
  });
});

test("computeResettableSteps handles equal startedOrder groups, overlaps, and precomputed sets", () => {
  const history: DurableHistoryEntry[] = [
    { stepId: "__origin", kind: "origin", startedOrder: 0, completedOrder: 0 },
    { stepId: "peer-a", kind: "step", startedOrder: 1, completedOrder: 1 },
    { stepId: "peer-b", kind: "step", startedOrder: 1, completedOrder: 2 },
    { stepId: "outer", kind: "step", startedOrder: 3, completedOrder: 6 },
    { stepId: "overlap", kind: "step", startedOrder: 4, completedOrder: 4 },
    { stepId: "after-all", kind: "step", startedOrder: 7, completedOrder: 7 },
    { stepId: "still-running", kind: "step", startedOrder: 8 },
    {
      stepId: "blocked-tail",
      kind: "step",
      startedOrder: 9,
      completedOrder: 9,
    },
  ];
  expect(computeResettableSteps(history)).toEqual([
    "peer-a",
    "peer-b",
    "outer",
    "after-all",
    "still-running",
  ]);

  const recorded: Execution = {
    ...execution,
    status: ExecutionStatus.Completed,
    historyRecorded: true,
  };
  const customResettable = new Set(["after-all"]);
  const nodes = observedTimeline(recorded, [], history, customResettable);
  expect(nodes.find((n) => n.id === "peer-a")?.resettable).toBeUndefined();
  expect(nodes.find((n) => n.id === "after-all")?.resettable).toBe(true);
});
