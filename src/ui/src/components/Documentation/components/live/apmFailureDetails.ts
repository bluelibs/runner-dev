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
export interface FailureRun extends RunRecord {
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
export interface FailureCursor {
  runs: number | null;
  errors: number | null;
}
interface FailureRecords {
  runs: FailureRun[];
  errors: ErrorEntry[];
}
export interface FailureDetailsPage {
  cursor?: FailureCursor;
  records?: FailureRecords;
  failures: FailureDetails[];
  hasMore: boolean;
}
const FAILURES_QUERY = `query ApmFailureDetails($runs: RunFilterInput!, $errors: ErrorFilterInput!, $beforeRuns: Float, $beforeErrors: Float, $readRuns: Boolean!, $readErrors: Boolean!) {
  live {
    runs(last: 50, beforeSequence: $beforeRuns, filter: $runs) @include(if: $readRuns) { sequence timestampMs nodeId nodeKind ok durationMs error correlationId parentId }
    errors(last: 50, beforeSequence: $beforeErrors, filter: $errors) @include(if: $readErrors) { sequence timestampMs sourceId sourceKind message stack correlationId }
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
  selection: FailureSelection,
  cursor?: FailureCursor
): Promise<FailureDetailsPage> {
  const { nodeId, nodeKind } = selection;
  const { live } = await graphqlRequest<{ live: Partial<FailureRecords> }>(
    FAILURES_QUERY,
    {
      beforeRuns: cursor?.runs ?? null,
      beforeErrors: cursor?.errors ?? null,
      readRuns: cursor?.runs !== null,
      readErrors: cursor?.errors !== null,
      runs: { nodeIds: [nodeId], nodeKinds: [nodeKind], ok: false },
      errors: { sourceIds: [nodeId], sourceKinds: [nodeKind] },
    }
  );
  const records = { runs: live.runs ?? [], errors: live.errors ?? [] };
  const before = (entries: { sequence: number }[]) =>
    entries.length === 50
      ? Math.min(...entries.map((entry) => entry.sequence))
      : null;
  const next = { runs: before(records.runs), errors: before(records.errors) };
  return {
    failures: deriveFailures(selection, records),
    records,
    cursor: next,
    hasMore: next.runs !== null || next.errors !== null,
  };
}
export function mergeFailurePages(
  selection: FailureSelection,
  previous: FailureDetailsPage | null,
  next: FailureDetailsPage
): FailureDetailsPage {
  const unique = <T extends { sequence: number }>(entries: T[]) =>
    Array.from(
      new Map(entries.map((entry) => [entry.sequence, entry])).values()
    );
  const records = {
    runs: unique([
      ...(previous?.records?.runs ?? []),
      ...(next.records?.runs ?? []),
    ]),
    errors: unique([
      ...(previous?.records?.errors ?? []),
      ...(next.records?.errors ?? []),
    ]),
  };
  // Keep raw pages so a run/error pair split across pages is joined once, rather than duplicated.
  return {
    ...next,
    records,
    failures: next.records
      ? deriveFailures(selection, records)
      : unique([...(previous?.failures ?? []), ...next.failures]).sort(
          (a, b) => b.sequence - a.sequence
        ),
  };
}
function deriveFailures(
  selection: FailureSelection,
  live: FailureRecords
): FailureDetails[] {
  const { scope, endTimestampMs, windowMinutes } = selection;
  const inWindow = (timestamp: number) =>
    timestamp >= endTimestampMs - windowMinutes * 60_000 &&
    timestamp <= endTimestampMs;
  const selected = live.runs.filter(
    (run) =>
      inWindow(run.timestampMs) &&
      (scope === "all" || (scope === "direct" ? !run.parentId : !!run.parentId))
  );
  const errorsByCorrelation = new Map<string, ErrorEntry[]>();
  for (const error of live.errors) {
    if (!error.correlationId) continue;
    const group = errorsByCorrelation.get(error.correlationId) ?? [];
    group.push(error);
    errorsByCorrelation.set(error.correlationId, group);
  }
  for (const group of errorsByCorrelation.values())
    group.sort((a, b) => a.timestampMs - b.timestampMs);
  const nearest = (correlationId: string, timestamp: number) => {
    const group = errorsByCorrelation.get(correlationId) ?? [];
    let low = 0,
      high = group.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (group[middle].timestampMs < timestamp) low = middle + 1;
      else high = middle;
    }
    const before = group[low - 1],
      after = group[low];
    if (!before) return after;
    if (!after) return before;
    return timestamp - before.timestampMs <= after.timestampMs - timestamp
      ? before
      : after;
  };
  const failures = selected.map((run): FailureDetails => {
    // Correlation ties the error to the execution chain; proximity handles repeated calls of the same node.
    const related = run.correlationId
      ? nearest(run.correlationId, run.timestampMs)
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
  const representedCorrelations = new Set(
    failures.map((failure) => failure.correlationId).filter(Boolean)
  );
  const representedAnonymous = new Set(
    failures.map((failure) => `${failure.timestampMs}:${failure.message}`)
  );
  if (scope === "all")
    for (const error of live.errors) {
      if (!inWindow(error.timestampMs)) continue;
      const represented = error.correlationId
        ? representedCorrelations.has(error.correlationId)
        : representedAnonymous.has(`${error.timestampMs}:${error.message}`);
      if (!represented) {
        representedCorrelations.add(error.correlationId);
        representedAnonymous.add(`${error.timestampMs}:${error.message}`);
        failures.push({
          sequence: error.sequence,
          timestampMs: error.timestampMs,
          message: error.message,
          stack: error.stack,
          correlationId: error.correlationId,
        });
      }
    }
  return failures.sort((a, b) => b.sequence - a.sequence);
}

export async function loadRetainedTrace(
  correlationId: string
): Promise<RetainedTrace> {
  const { live } = await graphqlRequest<{ live: RetainedTrace }>(TRACE_QUERY, {
    ids: [correlationId],
  });
  return live;
}
