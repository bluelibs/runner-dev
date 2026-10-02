import { graphqlRequest } from "../../utils/graphqlClient";
import type { ApmScope } from "../../../../../../resources/live/apm";
import type {
  ErrorEntry,
  LogEntry,
  EmissionEntry,
  RunRecord,
} from "../../hooks/liveTelemetry.types";

export interface FailureSelection {
  nodeId: string;
  nodeKind: "TASK" | "HOOK";
  windowMinutes: number;
  scope: ApmScope;
  endTimestampMs: number;
}
interface FailureRun extends RunRecord {
  parentId?: string | null;
}
export interface FailureDetails {
  sequence: number;
  timestampMs: number;
  message: string;
  stack?: string;
  correlationId?: string;
}
export interface RetainedTrace {
  logs: LogEntry[];
  emissions: EmissionEntry[];
  errors: ErrorEntry[];
  runs: RunRecord[];
}
const FAILURES_QUERY = `query ApmFailureDetails($runs: RunFilterInput!, $errors: ErrorFilterInput!) {
  live {
    runs(last: 50, filter: $runs) { sequence timestampMs nodeId nodeKind ok durationMs error correlationId parentId }
    errors(last: 50, filter: $errors) { sequence timestampMs sourceId sourceKind message stack correlationId }
  }
}`;
const TRACE_QUERY = `query ApmFailureTrace($ids: [String!]!) {
  live {
    logs(last: 200, filter: { correlationIds: $ids }) { sequence timestampMs level message data sourceId correlationId }
    emissions(last: 200, filter: { correlationIds: $ids }) { sequence timestampMs eventId emitterId payload correlationId }
    errors(last: 200, filter: { correlationIds: $ids }) { sequence timestampMs sourceId sourceKind message stack data correlationId }
    runs(last: 200, filter: { correlationIds: $ids }) { sequence timestampMs nodeId nodeKind ok durationMs error correlationId }
  }
}`;

export async function loadFailureDetails(
  selection: FailureSelection
): Promise<FailureDetails[]> {
  const { nodeId, nodeKind, scope, endTimestampMs, windowMinutes } = selection;
  const { live } = await graphqlRequest<{
    live: { runs: FailureRun[]; errors: ErrorEntry[] };
  }>(FAILURES_QUERY, {
    runs: { nodeIds: [nodeId], nodeKinds: [nodeKind], ok: false },
    errors: { sourceIds: [nodeId], sourceKinds: [nodeKind] },
  });
  const inWindow = (timestamp: number) =>
    timestamp >= endTimestampMs - windowMinutes * 60_000 &&
    timestamp <= endTimestampMs;
  const selected = live.runs.filter(
    (run) =>
      inWindow(run.timestampMs) &&
      (scope === "all" || (scope === "direct" ? !run.parentId : !!run.parentId))
  );
  const failures = selected.map((run): FailureDetails => {
    // Correlation ties the error to the execution chain; proximity handles repeated calls of the same node.
    const related = run.correlationId
      ? live.errors
          .filter((error) => error.correlationId === run.correlationId)
          .sort(
            (a, b) =>
              Math.abs(a.timestampMs - run.timestampMs) -
              Math.abs(b.timestampMs - run.timestampMs)
          )[0]
      : undefined;
    return {
      sequence: run.sequence,
      timestampMs: run.timestampMs,
      message: run.error ?? related?.message ?? "Execution failed",
      stack: related?.stack,
      correlationId: run.correlationId,
    };
  });
  // Error details can outlive runs. Their call scope is unknown, so show them only for All calls.
  if (scope === "all")
    for (const error of live.errors) {
      if (!inWindow(error.timestampMs)) continue;
      const represented = failures.some((failure) =>
        error.correlationId
          ? failure.correlationId === error.correlationId
          : failure.timestampMs === error.timestampMs &&
            failure.message === error.message
      );
      if (!represented)
        failures.push({
          sequence: error.sequence,
          timestampMs: error.timestampMs,
          message: error.message,
          stack: error.stack,
          correlationId: error.correlationId,
        });
    }
  return failures.sort((a, b) => b.sequence - a.sequence).slice(0, 50);
}

export async function loadRetainedTrace(
  correlationId: string
): Promise<RetainedTrace> {
  const { live } = await graphqlRequest<{ live: RetainedTrace }>(TRACE_QUERY, {
    ids: [correlationId],
  });
  return live;
}
