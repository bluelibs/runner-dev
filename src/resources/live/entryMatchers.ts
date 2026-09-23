import { idsMatch } from "./idCanonicalizer";
import type {
  EmissionEntry,
  EmissionQueryOptions,
  ErrorEntry,
  ErrorQueryOptions,
  LogEntry,
  LogQueryOptions,
  RunQueryOptions,
  RunRecord,
} from "./types";

type Predicate<T> = (entry: T) => boolean;

/** Combines the active predicates; with none active every entry matches. */
function allOf<T>(predicates: Array<Predicate<T> | null>): Predicate<T> {
  const active = predicates.filter(
    (predicate): predicate is Predicate<T> => predicate !== null
  );
  return (entry) => active.every((predicate) => predicate(entry));
}

function hasItems<T>(values: T[] | undefined): values is T[] {
  return values !== undefined && values.length > 0;
}

function oneOf<T, V>(
  values: V[] | undefined,
  read: (entry: T) => V
): Predicate<T> | null {
  if (!hasItems(values)) return null;
  const allowed = new Set(values);
  return (entry) => allowed.has(read(entry));
}

/** Id filters accept short ids, matching `app.tasks.server` for `server`. */
function idMatchesAny<T>(
  filterIds: string[] | undefined,
  read: (entry: T) => string | null | undefined
): Predicate<T> | null {
  if (!hasItems(filterIds)) return null;
  return (entry) => {
    const recordId = read(entry);
    return (
      recordId != null &&
      filterIds.some((filterId) => idsMatch(recordId, filterId))
    );
  };
}

function messageContains<T extends { message: string }>(
  fragment: string | undefined
): Predicate<T> | null {
  if (!fragment) return null;
  return (entry) => entry.message.includes(fragment);
}

// Stringified on both sides so entries without a correlation id compare as
// "null", matching the long-standing filter behavior.
function correlatedWith<T extends { correlationId?: string | null }>(
  correlationIds: string[] | undefined
): Predicate<T> | null {
  if (!hasItems(correlationIds)) return null;
  const allowed = new Set(correlationIds.map(String));
  return (entry) => allowed.has(String(entry.correlationId));
}

export function buildLogMatcher(options: LogQueryOptions): Predicate<LogEntry> {
  return allOf<LogEntry>([
    oneOf(options.levels, (entry) => entry.level),
    messageContains(options.messageIncludes),
    correlatedWith(options.correlationIds),
  ]);
}

export function buildEmissionMatcher(
  options: EmissionQueryOptions
): Predicate<EmissionEntry> {
  return allOf<EmissionEntry>([
    idMatchesAny(options.eventIds, (entry) => entry.eventId),
    idMatchesAny(options.emitterIds, (entry) => entry.emitterId),
    correlatedWith(options.correlationIds),
  ]);
}

export function buildErrorMatcher(
  options: ErrorQueryOptions
): Predicate<ErrorEntry> {
  return allOf<ErrorEntry>([
    oneOf(options.sourceKinds, (entry) => entry.sourceKind),
    idMatchesAny(options.sourceIds, (entry) => entry.sourceId),
    messageContains(options.messageIncludes),
    correlatedWith(options.correlationIds),
  ]);
}

export function buildRunMatcher(
  options: RunQueryOptions
): Predicate<RunRecord> {
  return allOf<RunRecord>([
    oneOf(options.nodeKinds, (entry) => entry.nodeKind),
    idMatchesAny(options.nodeIds, (entry) => entry.nodeId),
    typeof options.ok === "boolean" ? (entry) => entry.ok === options.ok : null,
    idMatchesAny(options.parentIds, (entry) => entry.parentId),
    idMatchesAny(options.rootIds, (entry) => entry.rootId),
    correlatedWith(options.correlationIds),
  ]);
}
