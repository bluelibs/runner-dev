import {
  resources,
  defineResource,
  type ResourceMiddlewareStoreElementType,
  type ResourceStoreElementType,
  type Store,
  type TaskMiddlewareStoreElementType,
} from "@bluelibs/runner";
import { getCorrelationId } from "./telemetry.chain";
import { RingBuffer } from "./live/RingBuffer";
import { createIdCanonicalizer } from "./live/idCanonicalizer";
import { createSequenceClock } from "./live/sequenceClock";
import { queryEntries, toQueryOptions } from "./live/entryQuery";
import {
  buildEmissionMatcher,
  buildErrorMatcher,
  buildLogMatcher,
  buildRunMatcher,
} from "./live/entryMatchers";
import type {
  EmissionEntry,
  EmissionQueryOptions,
  ErrorEntry,
  ErrorQueryOptions,
  Live,
  LiveEntryStamp,
  LiveRecordKind,
  LogEntry,
  LogLevel,
  LogQueryOptions,
  RunQueryOptions,
  RunRecord,
} from "./live/types";

export type {
  EmissionEntry,
  EmissionQueryOptions,
  ErrorEntry,
  ErrorQueryOptions,
  ErrorSourceKind,
  Live,
  LiveCursorOptions,
  LiveEntryStamp,
  LiveRecordKind,
  LogEntry,
  LogLevel,
  LogQueryOptions,
  RunNodeKind,
  RunQueryOptions,
  RunRecord,
} from "./live/types";

const DEFAULT_MAX_ENTRIES = 10_000;

function collectNodeIds(store: Store, eventIds: string[]): string[] {
  return [
    ...Array.from(store.tasks.values()).map((entry) => String(entry.task.id)),
    ...Array.from(store.hooks.values()).map((entry) => String(entry.hook.id)),
    ...Array.from(store.resources.values()).map(
      (entry: ResourceStoreElementType) => String(entry.resource.id)
    ),
    ...Array.from(store.taskMiddlewares.values()).map(
      (entry: TaskMiddlewareStoreElementType) => String(entry.middleware.id)
    ),
    ...Array.from(store.resourceMiddlewares.values()).map(
      (entry: ResourceMiddlewareStoreElementType) => String(entry.middleware.id)
    ),
    ...eventIds,
  ];
}

function describeError(error: unknown): {
  message: string;
  stack: string | null;
} {
  if (error instanceof Error)
    return { message: error.message, stack: error.stack ?? null };
  if (typeof error === "string") return { message: error, stack: null };
  try {
    return { message: JSON.stringify(error), stack: null };
  } catch {
    return { message: String(error), stack: null };
  }
}

function describeRunError(error: unknown): string | null {
  if (error == null) return null;
  return describeError(error).message;
}

const liveService = defineResource({
  id: "liveService",
  meta: {
    title: "Live Telemetry Service",
    description:
      "Core service for collecting and storing real-time telemetry data including logs, events, errors, and execution runs",
  },
  dependencies: {
    store: resources.store,
  },
  async init(
    c: { maxEntries?: number },
    { store }: { store: Store }
  ): Promise<Live> {
    const maxEntries = c.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const logs = new RingBuffer<LogEntry>(maxEntries);
    const emissions = new RingBuffer<EmissionEntry>(maxEntries);
    const errors = new RingBuffer<ErrorEntry>(maxEntries);
    const runs = new RingBuffer<RunRecord>(maxEntries);
    // One clock for every category, so a sequence identifies a single entry
    // store-wide and each category's entries stay in ascending order.
    const nextSequence = createSequenceClock();

    // The store is fully registered before any resource initializes, so the
    // id sets are final here and the canonicalizers can memoize safely.
    const eventIds = Array.from(store.events.values()).map((entry) =>
      String(entry.event.id)
    );
    const canonicalEventId = createIdCanonicalizer(eventIds);
    const canonicalNodeId = createIdCanonicalizer(
      collectNodeIds(store, eventIds)
    );

    const recordListeners = new Set<(kind: LiveRecordKind) => void>();
    const notifyRecordListeners = (kind: LiveRecordKind) => {
      for (const listener of recordListeners) {
        try {
          listener(kind);
        } catch {
          // Never let a listener error break telemetry recording
        }
      }
    };

    /** Stamps position and time on a new entry, stores it, then notifies. */
    const append = <T>(
      buffer: RingBuffer<T>,
      kind: LiveRecordKind,
      buildEntry: (stamp: LiveEntryStamp) => T
    ) => {
      const timestampMs = Date.now();
      const sequence = nextSequence(timestampMs);
      buffer.push(buildEntry({ sequence, timestampMs }));
      notifyRecordListeners(kind);
    };

    return {
      recordLog(level, message, data, correlationId, sourceId) {
        append(logs, "log", (stamp) => ({
          ...stamp,
          level,
          message,
          data,
          sourceId: canonicalNodeId(sourceId) ?? sourceId,
          correlationId: correlationId ?? getCorrelationId(),
        }));
      },
      getLogs(input) {
        const options: LogQueryOptions = toQueryOptions(input);
        return queryEntries(logs, options, buildLogMatcher(options));
      },
      recordEmission(eventId, payload, emitterId) {
        append(emissions, "emission", (stamp) => ({
          ...stamp,
          eventId: canonicalEventId(eventId) ?? eventId,
          emitterId: canonicalNodeId(emitterId),
          payload,
          correlationId: getCorrelationId(),
        }));
      },
      getEmissions(input) {
        const options: EmissionQueryOptions = toQueryOptions(input);
        return queryEntries(emissions, options, buildEmissionMatcher(options));
      },
      recordError(sourceId, sourceKind, error, data) {
        const { message, stack } = describeError(error);
        append(errors, "error", (stamp) => ({
          ...stamp,
          sourceId: canonicalNodeId(sourceId) ?? sourceId,
          sourceKind,
          message,
          stack,
          data,
          correlationId: getCorrelationId(),
        }));
      },
      getErrors(input) {
        const options: ErrorQueryOptions = toQueryOptions(input);
        return queryEntries(errors, options, buildErrorMatcher(options));
      },
      recordRun(nodeId, nodeKind, durationMs, ok, error, parentId, rootId) {
        append(runs, "run", (stamp) => ({
          ...stamp,
          nodeId: canonicalNodeId(nodeId) ?? nodeId,
          nodeKind,
          durationMs,
          ok,
          error: describeRunError(error),
          parentId: canonicalNodeId(parentId) ?? parentId ?? null,
          rootId: canonicalNodeId(rootId) ?? rootId ?? null,
          correlationId: getCorrelationId(),
        }));
      },
      getRuns(input) {
        const options: RunQueryOptions = toQueryOptions(input);
        return queryEntries(runs, options, buildRunMatcher(options));
      },
      onRecord(callback) {
        recordListeners.add(callback);
        return () => {
          recordListeners.delete(callback);
        };
      },
    };
  },
});

export const live = defineResource({
  id: "live",
  meta: {
    title: "Live Telemetry Manager",
    description:
      "Aggregates telemetry data from logger and exposes it through the live service interface for real-time monitoring",
  },
  dependencies: {
    liveService,
    logger: resources.logger,
  },
  register: (config: { maxEntries?: number }) => [
    liveService.with({ maxEntries: config?.maxEntries }),
  ],
  async init(_config, { liveService, logger }) {
    logger.onLog((log) => {
      const correlationId = getCorrelationId();
      liveService.recordLog(
        log.level as LogLevel,
        String(log.message),
        {
          ...log.data,
          ...(log.error ? { error: log.error } : {}),
        },
        correlationId,
        log.source
      );
    });

    return liveService;
  },
});
