import { observedTimeline } from "../../durable/projection";
import {
  ExecutionStatus,
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
