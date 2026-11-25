import type {
  DurableExecutionCurrent,
  DurableExecutionState,
  DurableHistoryEntry,
  Execution,
  ExecutionRetention,
  StepResult,
} from "@bluelibs/runner/node";
import z from "zod";
import type {
  StudioExecutionRetention,
  StudioExecutionSummary,
  StudioHistoryEntry,
  StudioRetentionSchedule,
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

function scheduleDeadlineIso(
  schedule: StudioRetentionSchedule | undefined,
  completedAt: Date | undefined
): string | null {
  if (!schedule || schedule === "retain" || !completedAt) return null;
  if (schedule === "delete") return completedAt.toISOString();
  return new Date(completedAt.getTime() + schedule.afterMs).toISOString();
}

export function formatRetention(
  policy?: ExecutionRetention | null,
  completedAt?: Date
): StudioExecutionRetention | null {
  if (!policy) return null;
  return {
    onComplete: policy.onComplete,
    ...(policy.receipts !== undefined ? { receipts: policy.receipts } : {}),
    ...(completedAt
      ? {
          historyCollectAt: scheduleDeadlineIso(policy.onComplete, completedAt),
          ...(policy.receipts !== undefined
            ? {
                receiptExpireAt: scheduleDeadlineIso(
                  policy.receipts,
                  completedAt
                ),
              }
            : {}),
        }
      : {}),
  };
}

/** Matches Runner's checkpoint-branch eligibility: top-level non-origin/command operations with no unfinished or overlapping predecessors. */
export function computeResettableSteps(
  history: DurableHistoryEntry[]
): string[] {
  return history
    .filter(
      (entry) =>
        !entry.parentStepId &&
        entry.kind !== "origin" &&
        entry.kind !== "command"
    )
    .filter((boundary) =>
      history
        .filter((other) => other.startedOrder < boundary.startedOrder)
        .every(
          (other) =>
            other.completedOrder !== undefined &&
            other.completedOrder < boundary.startedOrder
        )
    )
    .map((entry) => entry.stepId);
}

export function toStudioHistory(
  history: DurableHistoryEntry[]
): StudioHistoryEntry[] {
  return [...history]
    .sort((a, b) => a.startedOrder - b.startedOrder)
    .map((entry) => ({
      stepId: entry.stepId,
      kind: entry.kind,
      startedOrder: entry.startedOrder,
      ...(entry.parentStepId !== undefined
        ? { parentStepId: entry.parentStepId }
        : {}),
      ...(entry.taskKey !== undefined ? { taskKey: entry.taskKey } : {}),
      ...(entry.workflowVersion !== undefined
        ? { workflowVersion: entry.workflowVersion }
        : {}),
      ...(entry.completedOrder !== undefined
        ? { completedOrder: entry.completedOrder }
        : {}),
      ...(entry.stateAfter !== undefined ? { hasStateSnapshot: true } : {}),
    }));
}

function resolveWorkflowTitle(
  runtime: DashboardRuntime,
  workflowKey: string,
  workflowVersion?: number
): string {
  const versionEntry = runtime.workflowVersions
    ?.get(workflowKey)
    ?.find((entry) => entry.version === workflowVersion);
  if (versionEntry) {
    return versionEntry.task.meta?.title ?? workflowKey;
  }
  return runtime.workflows.get(workflowKey)?.meta?.title ?? workflowKey;
}

const lineageSchema = z.object({
  workflowVersion: z.number().optional(),
  continuedAsExecutionId: z.string().optional(),
  continuedFromExecutionId: z.string().optional(),
  restartedAsExecutionId: z.string().optional(),
  restartedFromExecutionId: z.string().optional(),
  resetFromExecutionId: z.string().optional(),
  resetBeforeStep: z.string().optional(),
  resetReason: z.string().optional(),
  historyCollectedAt: z.date().optional(),
});

export function toSummary(
  runtime: DashboardRuntime,
  state: DurableExecutionState | Execution
): StudioExecutionSummary {
  const lineage = lineageSchema.parse(state);
  const { historyCollectedAt, ...restLineage } = lineage;
  return {
    id: state.id,
    workflowKey: state.workflowKey,
    workflowTitle: resolveWorkflowTitle(
      runtime,
      state.workflowKey,
      lineage.workflowVersion
    ),
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
    ...restLineage,
    ...(historyCollectedAt
      ? { historyCollectedAt: historyCollectedAt.toISOString() }
      : {}),
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

function historyKindToNodeKind(kind: string): StudioTimelineNode["kind"] {
  if (kind === "signal") return "signal";
  if (kind === "sleep") return "sleep";
  if (kind === "switch") return "switch";
  if (kind === "workflow" || kind === "execution") return "child";
  if (kind === "command") return "command";
  if (kind === "state") return "state";
  if (kind === "continue") return "continue";
  return "step";
}

function historyKindDescription(kind: string): string {
  if (kind === "command") return "Tracked workflow command.";
  if (kind === "state") return "Workflow state update.";
  if (kind === "continue") return "Continue-as-new handoff.";
  if (kind === "workflow" || kind === "execution")
    return "Child workflow operation.";
  return "Persisted workflow operation.";
}

function stepToTimelineNode(
  execution: Execution,
  step: StepResult
): StudioTimelineNode {
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
}

/** Observed persisted history; do not invent future branches from executable code. */
export function observedTimeline(
  execution: Execution,
  steps: StepResult[],
  history?: DurableHistoryEntry[]
): StudioTimelineNode[] {
  const nodes: StudioTimelineNode[] = [];
  if (history && history.length > 0) {
    const sorted = [...history].sort((a, b) => a.startedOrder - b.startedOrder);
    const stepMap = new Map(steps.map((step) => [step.stepId, step]));
    const resettable = new Set(
      execution.historyRecorded && !execution.historyCollectedAt
        ? computeResettableSteps(sorted)
        : []
    );
    const coveredStepIds = new Set<string>();

    for (const entry of sorted) {
      if (entry.kind === "origin") continue;
      const step = stepMap.get(entry.stepId);
      if (step) coveredStepIds.add(step.stepId);
      const parsed = markerSchema.safeParse(
        step && (entry.stepId.startsWith("__") || entry.kind === "switch")
          ? step.result
          : undefined
      );
      const marker = parsed.success ? parsed.data : {};
      const waiting =
        (entry.kind === "signal" ||
          entry.kind === "sleep" ||
          entry.stepId.startsWith("__signal:") ||
          entry.stepId.startsWith("__sleep:")) &&
        (marker.state === "waiting" || marker.state === "sleeping");
      const state: StudioTimelineNode["state"] = waiting
        ? isTerminal(execution.status)
          ? "unreached"
          : "waiting"
        : entry.completedOrder !== undefined || step !== undefined
        ? "completed"
        : !isTerminal(execution.status)
        ? "active"
        : "unreached";
      nodes.push({
        id: entry.stepId,
        label: entry.stepId,
        description: historyKindDescription(entry.kind),
        kind: historyKindToNodeKind(entry.kind),
        state,
        branchTaken: marker.branchId ?? null,
        result: step
          ? jsonSafe(step.result)
          : entry.stateAfter !== undefined
          ? jsonSafe(entry.stateAfter ? entry.stateAfter.value : null)
          : null,
        completedAt: step ? step.completedAt.toISOString() : null,
        ...(entry.parentStepId !== undefined
          ? { parentStepId: entry.parentStepId }
          : {}),
        ...(entry.taskKey !== undefined ? { taskKey: entry.taskKey } : {}),
        ...(entry.workflowVersion !== undefined
          ? { workflowVersion: entry.workflowVersion }
          : {}),
        ...(resettable.has(entry.stepId) ? { resettable: true } : {}),
        wait: waiting ? marker : null,
      });
    }

    for (const step of steps) {
      if (!coveredStepIds.has(step.stepId)) {
        nodes.push(stepToTimelineNode(execution, step));
      }
    }
  } else {
    nodes.push(...steps.map((step) => stepToTimelineNode(execution, step)));
  }

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
