import { TELEMETRY_CATEGORIES, advanceCursors } from "./liveTelemetryCursors";
import type {
  HealthSnapshot,
  LiveData,
  TelemetryCategory,
  TelemetryCursors,
  TelemetryDelta,
} from "./liveTelemetry.types";

/**
 * Entries per category per request once a cursor exists. It matches the
 * client-side buffer, so a single page can refresh the whole view.
 */
export const POLL_PAGE_SIZE = 100;
/**
 * Upper bound on requests per poll tick. Categories that return a full page
 * are re-queried (drained) so steady load can't leave them further behind
 * each tick; the bound keeps one tick from looping forever under a flood.
 */
export const MAX_POLL_PAGES_PER_TICK = 10;

// Each category has its own cursor and window, and `@include` lets drain
// rounds re-query only the categories that are still behind.
export const LIVE_TELEMETRY_QUERY = `
  query LiveTelemetry(
    $healthIncluded: Boolean!
    $logsIncluded: Boolean!
    $logsAfter: Float
    $logsLast: Int
    $emissionsIncluded: Boolean!
    $emissionsAfter: Float
    $emissionsLast: Int
    $errorsIncluded: Boolean!
    $errorsAfter: Float
    $errorsLast: Int
    $runsIncluded: Boolean!
    $runsAfter: Float
    $runsLast: Int
  ) {
    live {
      memory @include(if: $healthIncluded) { heapUsed heapTotal rss }
      cpu @include(if: $healthIncluded) { usage loadAverage }
      eventLoop @include(if: $healthIncluded) { lag }
      gc(windowMs: 30000) @include(if: $healthIncluded) { collections duration }
      logs(afterSequence: $logsAfter, last: $logsLast) @include(if: $logsIncluded) {
        sequence timestampMs level message data correlationId sourceId
      }
      emissions(afterSequence: $emissionsAfter, last: $emissionsLast) @include(if: $emissionsIncluded) {
        sequence timestampMs eventId emitterId payload correlationId
        eventResolved { id tags { id config } meta { title description } }
      }
      errors(afterSequence: $errorsAfter, last: $errorsLast) @include(if: $errorsIncluded) {
        sequence timestampMs sourceId sourceKind message stack data correlationId
        sourceResolved { id tags { id config } meta { title description } }
      }
      runs(afterSequence: $runsAfter, last: $runsLast) @include(if: $runsIncluded) {
        sequence timestampMs nodeId nodeKind ok durationMs error correlationId
      }
    }
  }
`;

export interface LiveTelemetryResponse {
  live: Partial<LiveData>;
}

export type GraphqlRequest = <T>(
  query: string,
  variables?: Record<string, unknown>
) => Promise<T>;

export interface LiveTelemetryPoll {
  health: Partial<HealthSnapshot>;
  delta: TelemetryDelta;
}

interface CategoryPage {
  afterSequence: number | null;
  last: number;
}

type RoundPlan = Partial<Record<TelemetryCategory, CategoryPage>>;

/**
 * Without a cursor the server returns the most recent `historySize` entries
 * (initial view); with one, it returns the oldest page after the cursor.
 */
function pageFor(cursor: number | null, historySize: number): CategoryPage {
  return cursor === null
    ? { afterSequence: null, last: historySize }
    : { afterSequence: cursor, last: POLL_PAGE_SIZE };
}

function toVariables(
  plan: RoundPlan,
  healthIncluded: boolean
): Record<string, unknown> {
  const variables: Record<string, unknown> = { healthIncluded };
  for (const category of TELEMETRY_CATEGORIES) {
    const page = plan[category];
    variables[`${category}Included`] = page !== undefined;
    variables[`${category}After`] = page?.afterSequence ?? null;
    variables[`${category}Last`] = page?.last ?? null;
  }
  return variables;
}

/** Reads the fetched categories, treating a missing list as empty. */
function readDelta(live: Partial<LiveData>, plan: RoundPlan): TelemetryDelta {
  const fetched = <T>(category: TelemetryCategory, entries: T[] | undefined) =>
    plan[category] === undefined ? undefined : entries ?? [];
  return {
    logs: fetched("logs", live.logs),
    emissions: fetched("emissions", live.emissions),
    errors: fetched("errors", live.errors),
    runs: fetched("runs", live.runs),
  };
}

function appendEntries<T>(
  existing: T[] | undefined,
  incoming: T[] | undefined
): T[] | undefined {
  if (incoming === undefined) return existing;
  return existing === undefined ? incoming : [...existing, ...incoming];
}

function appendDelta(
  existing: TelemetryDelta,
  incoming: TelemetryDelta
): TelemetryDelta {
  return {
    logs: appendEntries(existing.logs, incoming.logs),
    emissions: appendEntries(existing.emissions, incoming.emissions),
    errors: appendEntries(existing.errors, incoming.errors),
    runs: appendEntries(existing.runs, incoming.runs),
  };
}

/** A category is behind when a cursor page came back full. */
function laggingCategories(
  plan: RoundPlan,
  live: Partial<LiveData>
): TelemetryCategory[] {
  return TELEMETRY_CATEGORIES.filter((category) => {
    const page = plan[category];
    return (
      page !== undefined &&
      page.afterSequence !== null &&
      (live[category]?.length ?? 0) >= page.last
    );
  });
}

/**
 * One polling tick: fetches health plus every category from its own cursor,
 * then keeps re-querying only the categories whose cursor page came back
 * full, up to MAX_POLL_PAGES_PER_TICK requests.
 */
export async function pollLiveTelemetry(
  request: GraphqlRequest,
  options: { cursors: TelemetryCursors; historySize: number }
): Promise<LiveTelemetryPoll> {
  let cursors = options.cursors;
  let plan: RoundPlan = {};
  for (const category of TELEMETRY_CATEGORIES) {
    plan[category] = pageFor(cursors[category], options.historySize);
  }

  let health: Partial<HealthSnapshot> = {};
  let delta: TelemetryDelta = {};
  for (let round = 0; round < MAX_POLL_PAGES_PER_TICK; round++) {
    const { live } = await request<LiveTelemetryResponse>(
      LIVE_TELEMETRY_QUERY,
      toVariables(plan, round === 0)
    );
    if (round === 0) {
      health = {
        memory: live.memory,
        cpu: live.cpu,
        eventLoop: live.eventLoop,
        gc: live.gc,
      };
    }
    const page = readDelta(live, plan);
    delta = appendDelta(delta, page);
    cursors = advanceCursors(cursors, page);

    const lagging = laggingCategories(plan, live);
    if (lagging.length === 0) break;
    plan = {};
    for (const category of lagging) {
      plan[category] = pageFor(cursors[category], options.historySize);
    }
  }
  return { health, delta };
}
