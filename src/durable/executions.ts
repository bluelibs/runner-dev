import type { Execution } from "@bluelibs/runner/node";
import { ExecutionStatus } from "@bluelibs/runner/node";
import z from "zod";
import type {
  StudioExecutionDetail,
  StudioExecutionPage,
  StudioExecutionStatus,
} from "./shared/types";
import {
  type DashboardRuntime,
  getBackingStore,
  safeGetOperator,
} from "./runtime";
import { DurableHttpError, requireValue } from "./errors";
import {
  computeResettableSteps,
  formatRetention,
  isTerminal,
  jsonSafe,
  observedTimeline,
  toStudioHistory,
  toSummary,
} from "./projection";

const statuses = z.nativeEnum(ExecutionStatus);
const filtersSchema = z.object({
  workflowKey: z.string().optional(),
  status: z.union([statuses, z.literal("live")]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: z.string().optional(),
  executionId: z.string().optional(),
});

export async function listExecutions(
  runtime: DashboardRuntime,
  input: unknown
): Promise<StudioExecutionPage> {
  const query = filtersSchema.parse(input);
  const status =
    query.status === "live"
      ? Object.values(ExecutionStatus).filter((status) => !isTerminal(status))
      : query.status
      ? [query.status]
      : undefined;
  const page = await runtime.durable.operator.listExecutionStates({
    ...query,
    status,
  });
  return {
    executions: page.states.map((state) => toSummary(runtime, state)),
    hasMore: page.nextCursor !== null,
    nextCursor: page.nextCursor,
    nextOffset: null,
  };
}

export async function requireExecution(
  runtime: DashboardRuntime,
  id: string
): Promise<Execution> {
  const detail = await runtime.durable.operator.getExecutionDetail(id);
  return requireValue(
    detail.execution,
    `Unknown execution '${id}' in '${runtime.descriptor.id}'.`
  );
}

const detailExtras = z.object({
  pausedFrom: z
    .enum([
      "pending",
      "running",
      "cancelling",
      "retrying",
      "sleeping",
      "paused",
      "completed",
      "compensation_failed",
      "failed",
      "cancelled",
      "continued_as_new",
    ])
    .optional(),
  state: z
    .object({ state: z.unknown(), updatedAt: z.date() })
    .nullable()
    .optional(),
});

async function resolveContinuedTipStatus(
  runtime: DashboardRuntime,
  execution: Execution
): Promise<StudioExecutionStatus | undefined> {
  if (
    execution.status !== "continued_as_new" ||
    !execution.continuedAsExecutionId
  ) {
    return undefined;
  }
  let nextId: string | undefined = execution.continuedAsExecutionId;
  for (let hops = 0; hops < 25 && nextId; hops += 1) {
    const tipDetail = await runtime.durable.operator.getExecutionDetail(nextId);
    const tip = tipDetail.execution;
    if (!tip) break;
    if (tip.status !== "continued_as_new" || !tip.continuedAsExecutionId) {
      return tip.status;
    }
    nextId = tip.continuedAsExecutionId;
  }
  return undefined;
}

export async function getExecutionDetail(
  runtime: DashboardRuntime,
  id: string
): Promise<StudioExecutionDetail> {
  const raw = await runtime.durable.operator.getExecutionDetail(id);
  const execution = requireValue(
    raw.execution,
    `Unknown execution '${id}' in '${runtime.descriptor.id}'.`
  );
  const backingStore = getBackingStore(runtime.durable);
  const [children, signals, parent, rawHistory, continuedChainTipStatus] =
    await Promise.all([
      runtime.durable.operator.listChildExecutions(id, { limit: 100 }),
      runtime.durable.operator.listSignals(id),
      execution.parentExecutionId
        ? runtime.durable.operator.getExecutionState(
            execution.parentExecutionId
          )
        : null,
      backingStore?.listExecutionHistory
        ? backingStore.listExecutionHistory(id)
        : Promise.resolve([]),
      resolveContinuedTipStatus(runtime, execution),
    ]);
  const extras = detailExtras.parse({ ...raw, ...execution });
  const resettableSteps =
    execution.historyRecorded && !execution.historyCollectedAt
      ? computeResettableSteps(rawHistory)
      : [];
  const retention = formatRetention(execution.retention, execution.completedAt);
  return {
    ...toSummary(runtime, execution),
    maxAttempts: execution.maxAttempts,
    input: jsonSafe(execution.input),
    result: jsonSafe(execution.result ?? null),
    error: execution.error ?? null,
    pausedFrom: extras.pausedFrom,
    ...(continuedChainTipStatus !== undefined
      ? { continuedChainTipStatus }
      : {}),
    ...(execution.historyRecorded !== undefined
      ? { historyRecorded: execution.historyRecorded }
      : {}),
    ...(retention !== null ? { retention } : {}),
    timeline: observedTimeline(execution, raw.steps, rawHistory),
    edges: [],
    steps: raw.steps.map((step) => ({
      stepId: step.stepId,
      result: jsonSafe(step.result),
      completedAt: step.completedAt.toISOString(),
    })),
    ...(rawHistory.length > 0 ? { history: toStudioHistory(rawHistory) } : {}),
    ...(resettableSteps.length > 0 ? { resettableSteps } : {}),
    audit: raw.audit.map(
      ({ id, at, kind, attempt, executionId: _executionId, ...detail }) => ({
        id,
        at: at.toISOString(),
        kind,
        attempt,
        detail: z.record(z.string(), z.unknown()).parse(jsonSafe(detail)),
      })
    ),
    signals: signals.map((signal) => {
      const queued = new Set(signal.queued.map((record) => record.id));
      return {
        signalId: signal.signalId,
        history: signal.history.map((record) => ({
          id: record.id,
          payload: jsonSafe(record.payload),
          receivedAt: record.receivedAt.toISOString(),
          state: queued.has(record.id) ? "queued" : "consumed",
        })),
      };
    }),
    state: extras.state
      ? {
          state: jsonSafe(extras.state.state),
          updatedAt: extras.state.updatedAt.toISOString(),
        }
      : null,
    relations: {
      parent: parent ? toSummary(runtime, parent) : null,
      children: children.map((child) => toSummary(runtime, child)),
    },
  };
}

export async function exportReplayFixture(
  runtime: DashboardRuntime,
  id: string
): Promise<{ fixture: unknown }> {
  const execution = await requireExecution(runtime, id);
  const operator = safeGetOperator(runtime.durable);
  if (
    !runtime.descriptor.capabilities.replay ||
    typeof operator?.exportReplay !== "function"
  ) {
    throw new DurableHttpError(
      409,
      "Replay export is unavailable with this Runner version."
    );
  }
  if (execution.historyCollectedAt) {
    throw new DurableHttpError(
      409,
      "Execution history was collected and cannot be exported."
    );
  }
  if (!execution.historyRecorded) {
    throw new DurableHttpError(
      409,
      "No ordered history was recorded for this execution."
    );
  }
  const fixture = await operator.exportReplay(id);
  return { fixture: jsonSafe(fixture) };
}

export function requireActive(execution: Execution): void {
  if (isTerminal(execution.status))
    throw new DurableHttpError(
      409,
      `Execution '${execution.id}' is already ${execution.status}.`
    );
}
