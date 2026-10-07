import type { Execution } from "@bluelibs/runner/node";
import { ExecutionStatus } from "@bluelibs/runner/node";
import z from "zod";
import type {
  StudioExecutionDetail,
  StudioExecutionPage,
} from "./shared/types";
import type { DashboardRuntime } from "./runtime";
import { DurableHttpError, requireValue } from "./errors";
import {
  isTerminal,
  jsonSafe,
  observedTimeline,
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

export async function getExecutionDetail(
  runtime: DashboardRuntime,
  id: string
): Promise<StudioExecutionDetail> {
  const raw = await runtime.durable.operator.getExecutionDetail(id);
  const execution = requireValue(
    raw.execution,
    `Unknown execution '${id}' in '${runtime.descriptor.id}'.`
  );
  const [children, signals, parent] = await Promise.all([
    runtime.durable.operator.listChildExecutions(id, { limit: 100 }),
    runtime.durable.operator.listSignals(id),
    execution.parentExecutionId
      ? runtime.durable.operator.getExecutionState(execution.parentExecutionId)
      : null,
  ]);
  const extras = detailExtras.parse({ ...raw, ...execution });
  return {
    ...toSummary(runtime, execution),
    maxAttempts: execution.maxAttempts,
    input: jsonSafe(execution.input),
    result: jsonSafe(execution.result ?? null),
    error: execution.error ?? null,
    pausedFrom: extras.pausedFrom,
    timeline: observedTimeline(execution, raw.steps),
    edges: [],
    steps: raw.steps.map((step) => ({
      stepId: step.stepId,
      result: jsonSafe(step.result),
      completedAt: step.completedAt.toISOString(),
    })),
    audit: raw.audit.map(
      ({ id, at, kind, attempt, executionId: _executionId, ...detail }) => ({
        id,
        at: at.toISOString(),
        kind,
        attempt,
        detail: z.record(z.unknown()).parse(jsonSafe(detail)),
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

export function requireActive(execution: Execution): void {
  if (isTerminal(execution.status))
    throw new DurableHttpError(
      409,
      `Execution '${execution.id}' is already ${execution.status}.`
    );
}
