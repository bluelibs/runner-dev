import type {
  DurableExecutionCurrent,
  DurableExecutionState,
  Execution,
  StepResult,
} from "@bluelibs/runner/node";
import z from "zod";
import type {
  StudioExecutionSummary,
  StudioTimelineNode,
} from "./shared/types";
import type { DashboardRuntime } from "./runtime";

/** Convert persisted values at the JSON boundary, preserving date meaning. */
export function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, jsonSafe(child)])
    );
  }
  return value;
}

export function isTerminal(status: string): boolean {
  return [
    "completed",
    "failed",
    "cancelled",
    "compensation_failed",
    "continued_as_new",
  ].includes(status);
}

export function position(current?: DurableExecutionCurrent): string | null {
  if (!current) return null;
  if (current.kind === "waitForSignal")
    return `Waiting for signal \`${current.waitingFor.params.signalId}\``;
  if (current.kind === "waitForExecution")
    return `Waiting for execution \`${current.waitingFor.params.targetExecutionId}\``;
  return `${current.kind === "sleep" ? "Sleeping at" : "Running"} \`${
    current.stepId
  }\``;
}

const lineageSchema = z.object({
  continuedAsExecutionId: z.string().optional(),
  continuedFromExecutionId: z.string().optional(),
  restartedAsExecutionId: z.string().optional(),
  restartedFromExecutionId: z.string().optional(),
});

export function toSummary(
  runtime: DashboardRuntime,
  state: DurableExecutionState | Execution
): StudioExecutionSummary {
  return {
    id: state.id,
    workflowKey: state.workflowKey,
    workflowTitle:
      runtime.workflows.get(state.workflowKey)?.meta?.title ??
      state.workflowKey,
    status: state.status,
    attempt: state.attempt,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
    completedAt: state.completedAt?.toISOString() ?? null,
    position: isTerminal(state.status)
      ? String(state.status) === "failed"
        ? "error" in state && state.error?.stepId
          ? `Failed at \`${state.error.stepId}\``
          : "Failed"
        : String(state.status).replace(/_/g, " ")
      : position(state.current),
    ...(state.parentExecutionId
      ? { parentExecutionId: state.parentExecutionId }
      : {}),
    ...lineageSchema.parse(state),
  };
}

const markerSchema = z.object({
  state: z.string().optional(),
  branchId: z.string().optional(),
  signalId: z.string().optional(),
  targetExecutionId: z.string().optional(),
  timeoutAtMs: z.number().optional(),
  fireAtMs: z.number().optional(),
});

function nodeKind(
  id: string,
  current?: DurableExecutionCurrent
): StudioTimelineNode["kind"] {
  if (current?.kind === "waitForSignal" || id.startsWith("__signal:"))
    return "signal";
  if (current?.kind === "sleep" || id.startsWith("__sleep:")) return "sleep";
  if (current?.kind === "waitForExecution") return "child";
  if (current?.kind === "switch") return "switch";
  if (id.startsWith("__note:")) return "note";
  return "step";
}

/** Observed persisted history; do not invent future branches from executable code. */
export function observedTimeline(
  execution: Execution,
  steps: StepResult[]
): StudioTimelineNode[] {
  const nodes: StudioTimelineNode[] = steps.map((step) => {
    const parsed = markerSchema.safeParse(
      step.stepId.startsWith("__") ? step.result : undefined
    );
    const marker = parsed.success ? parsed.data : {};
    const waiting =
      (step.stepId.startsWith("__signal:") ||
        step.stepId.startsWith("__sleep:")) &&
      (marker.state === "waiting" || marker.state === "sleeping");
    return {
      id: step.stepId,
      label: step.stepId,
      description: "Persisted workflow step.",
      kind: nodeKind(step.stepId),
      state: waiting
        ? isTerminal(execution.status)
          ? "unreached"
          : "waiting"
        : "completed",
      branchTaken: marker.branchId ?? null,
      result: jsonSafe(step.result),
      completedAt: step.completedAt.toISOString(),
      wait: waiting ? marker : null,
    };
  });
  const current = execution.current;
  if (current && !isTerminal(execution.status)) {
    const node: StudioTimelineNode = {
      id: current.stepId,
      label: current.stepId,
      description: "Current workflow position.",
      kind: nodeKind(current.stepId, current),
      state:
        current.kind === "step" || current.kind === "switch"
          ? "active"
          : "waiting",
      branchTaken: null,
      result: null,
      completedAt: null,
      wait:
        "waitingFor" in current
          ? markerSchema.parse(current.waitingFor.params)
          : null,
    };
    const index = nodes.findIndex((existing) => existing.id === current.stepId);
    if (index < 0) nodes.push(node);
    else nodes[index] = { ...nodes[index], ...node };
  }
  if (execution.status === "failed" && execution.error?.stepId) {
    const failedId = execution.error.stepId;
    const index = nodes.findIndex((node) => node.id === failedId);
    if (index >= 0) nodes[index].state = "failed";
    else
      nodes.push({
        id: failedId,
        label: failedId,
        description: "Failed step.",
        kind: "step",
        state: "failed",
        branchTaken: null,
        result: null,
        completedAt: null,
        wait: null,
      });
  }
  return nodes;
}
