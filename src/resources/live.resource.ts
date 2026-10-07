import {
  resources,
  defineResource,
  type ResourceMiddlewareStoreElementType,
  type ResourceStoreElementType,
  type Store,
  type TaskMiddlewareStoreElementType,
} from "@bluelibs/runner";
import { apmPersistenceDefinition } from "./live/apmPersistence";
import type { createApm } from "./live/apm";
import { initializeApm } from "./live/initializeApm";
import { getCorrelationId } from "./telemetry.chain";
import type {
  LiveConfig,
  LivePersistedEntry,
  LivePersistence,
} from "./live/persistence";
import { parsePersistedEntry } from "./live/persistence.schema";
import {
  commitPersistence,
  isPersistenceResource,
  persistenceResourceDefinition,
  restorePersistence,
} from "./live/persistenceProvider";
import { createEntryBuffers } from "./live/entryBuffers";
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
  EmissionQueryOptions,
  ErrorQueryOptions,
  Live,
  LiveEntryStamp,
  LiveRecordKind,
  LogQueryOptions,
  RunQueryOptions,
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
    return { message: JSON.stringify(error) ?? String(error), stack: null };
  } catch {
    return { message: String(error), stack: null };
  }
}

function describeRunError(error: unknown): string | null {
  if (error == null) return null;
  return describeError(error).message;
}

function createPersistenceContext(): {
  closed: boolean;
  apm: ReturnType<typeof createApm> | undefined;
} {
  return { closed: false, apm: undefined };
}

const liveService = defineResource({
  context: createPersistenceContext,
  id: "liveService",
  meta: {
    title: "Live Telemetry Service",
    description:
      "Core service for collecting and storing real-time telemetry data including logs, events, errors, and execution runs",
  },
  register: (config: LiveConfig) => [
    ...(isPersistenceResource(config.persistence) ? [config.persistence] : []),
    ...(typeof config.apm === "object" && config.apm.persistence
      ? [config.apm.persistence]
      : []),
  ],
  dependencies: (config: LiveConfig) => {
    const provider = persistenceResourceDefinition(config.persistence);
    const apmProvider = apmPersistenceDefinition(
      typeof config.apm === "object" ? config.apm.persistence : undefined
    );
    return {
      store: resources.store,
      ...(provider ? { persistence: provider } : {}),
      ...(apmProvider ? { apmPersistence: apmProvider } : {}),
    };
  },
  async init(
    c: LiveConfig,
    { store, persistence, apmPersistence },
    context
  ): Promise<Live> {
    const maxEntries = c.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const buffers = createEntryBuffers(maxEntries);
    const { logs, emissions, errors, runs } = buffers;
    let lastSequence = 0;
    let persistenceStore: LivePersistence | undefined;
    if (c.persistence !== undefined) {
      const restored = await restorePersistence(
        persistence,
        maxEntries,
        buffers
      );
      persistenceStore = restored.persistence;
      lastSequence = restored.lastSequence;
    }
    const apm = await initializeApm(c.apm, apmPersistence);
    context.apm = apm;
    // Seed above persisted entries even after a backwards clock adjustment.
    const nextSequence = createSequenceClock(lastSequence);

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

    /** Accepts persistence before publishing the new entry to readers. */
    const append = (record: LivePersistedEntry) => {
      if (context.closed) throw new Error("Live telemetry store is closed.");
      // Rejected commits/enqueues must not appear in the live view.
      if (persistenceStore) {
        parsePersistedEntry(record);
        commitPersistence(persistenceStore, record, maxEntries);
      }
      if (record.kind === "run") apm.record(record.entry);
      buffers.append(record);
      notifyRecordListeners(record.kind);
    };
    const stamp = (): LiveEntryStamp => {
      const timestampMs = Date.now();
      const sequence = nextSequence(timestampMs);
      return { sequence, timestampMs };
    };

    return {
      getApm: (windowMinutes, scope) => apm.snapshot(windowMinutes, scope),
      recordLog(level, message, data, correlationId, sourceId) {
        append({
          kind: "log",
          entry: {
            ...stamp(),
            level,
            message,
            data,
            sourceId: canonicalNodeId(sourceId) ?? sourceId,
            correlationId: correlationId ?? getCorrelationId(),
          },
        });
      },
      getLogs(input) {
        const options: LogQueryOptions = toQueryOptions(input);
        return queryEntries(logs, options, buildLogMatcher(options));
      },
      recordEmission(eventId, payload, emitterId) {
        append({
          kind: "emission",
          entry: {
            ...stamp(),
            eventId: canonicalEventId(eventId) ?? eventId,
            emitterId: canonicalNodeId(emitterId),
            payload,
            correlationId: getCorrelationId(),
          },
        });
      },
      getEmissions(input) {
        const options: EmissionQueryOptions = toQueryOptions(input);
        return queryEntries(emissions, options, buildEmissionMatcher(options));
      },
      recordError(sourceId, sourceKind, error, data) {
        const { message, stack } = describeError(error);
        append({
          kind: "error",
          entry: {
            ...stamp(),
            sourceId: canonicalNodeId(sourceId) ?? sourceId,
            sourceKind,
            message,
            stack,
            data,
            correlationId: getCorrelationId(),
          },
        });
      },
      getErrors(input) {
        const options: ErrorQueryOptions = toQueryOptions(input);
        return queryEntries(errors, options, buildErrorMatcher(options));
      },
      recordRun(nodeId, nodeKind, durationMs, ok, error, parentId, rootId) {
        append({
          kind: "run",
          entry: {
            ...stamp(),
            nodeId: canonicalNodeId(nodeId) ?? nodeId,
            nodeKind,
            durationMs,
            ok,
            error: describeRunError(error),
            parentId: canonicalNodeId(parentId) ?? parentId ?? null,
            rootId: canonicalNodeId(rootId) ?? rootId ?? null,
            correlationId: getCorrelationId(),
          },
        });
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
  async dispose(_instance, _config, _deps, context) {
    context.closed = true;
    await context.apm?.close();
  },
});

export const live = defineResource({
  context: () => ({ active: true }),
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
  register: (config: LiveConfig) => [
    liveService.with({
      apm: config?.apm,
      maxEntries: config?.maxEntries,
      persistence: config?.persistence,
    }),
  ],
  async init(_config, { liveService, logger }, context) {
    logger.onLog((log) => {
      if (!context.active) return;
      const correlationId = getCorrelationId();
      liveService.recordLog(
        log.level,
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
  async dispose(_instance, _config, _deps, context) {
    context.active = false;
  },
});
