import { globals, resource, task, hook } from "@bluelibs/runner";
import { deriveParentAndRoot, getCorrelationId } from "./telemetry.chain";

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "log";

export interface LogEntry {
  timestampMs: number;
  level: LogLevel;
  message: string;
  sourceId?: string | null;
  data?: unknown;
  correlationId?: string | null;
}
export interface EmissionEntry {
  timestampMs: number;
  eventId: string;
  emitterId?: string | null;
  payload?: unknown;
  correlationId?: string | null;
}

export interface ErrorEntry {
  timestampMs: number;
  sourceId: string;
  sourceKind: "TASK" | "HOOK" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL";
  message: string;
  stack?: string | null;
  data?: unknown;
  correlationId?: string | null;
}

export interface RunRecord {
  timestampMs: number;
  nodeId: string;
  nodeKind: "TASK" | "HOOK";
  durationMs: number;
  ok: boolean;
  error?: string | null;
  parentId?: string | null;
  rootId?: string | null;
  correlationId?: string | null;
}

export interface Live {
  getLogs(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          levels?: LogLevel[];
          messageIncludes?: string;
          correlationIds?: string[];
        }
  ): LogEntry[];
  getEmissions(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          eventIds?: string[];
          emitterIds?: string[];
        }
  ): EmissionEntry[];
  getErrors(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          sourceKinds?: (
            | "TASK"
            | "HOOK"
            | "RESOURCE"
            | "MIDDLEWARE"
            | "INTERNAL"
          )[];
          sourceIds?: string[];
          messageIncludes?: string;
        }
  ): ErrorEntry[];
  getRuns(
    options?:
      | number
      | {
          afterTimestamp?: number;
          last?: number;
          nodeKinds?: ("TASK" | "HOOK")[];
          nodeIds?: string[];
          ok?: boolean;
          parentIds?: string[];
          rootIds?: string[];
        }
  ): RunRecord[];
  recordLog(
    level: LogLevel,
    message: string,
    data?: unknown,
    correlationId?: string | null,
    sourceId?: string | null
  ): void;
  recordEmission(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): void;
  recordError(
    sourceId: string,
    sourceKind: "TASK" | "HOOK" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL",
    error: unknown,
    data?: unknown
  ): void;
  recordRun(
    nodeId: string,
    nodeKind: "TASK" | "HOOK",
    durationMs: number,
    ok: boolean,
    error?: unknown,
    parentId?: string | null,
    rootId?: string | null
  ): void;
}

const liveService = resource({
  id: "runner-dev.resources.live-service",
  async init(c: { maxEntries?: number }): Promise<Live> {
    const maxEntries = c?.maxEntries ?? 10000;
    const logs: LogEntry[] = [];
    const emissions: EmissionEntry[] = [];
    const errors: ErrorEntry[] = [];
    const runs: RunRecord[] = [];
    const trim = <T>(arr: T[]) => {
      const overflow = arr.length - maxEntries;
      if (overflow > 0) arr.splice(0, overflow);
    };
    const normalizeError = (
      error: unknown
    ): { message: string; stack: string | null } => {
      if (error instanceof Error)
        return { message: error.message, stack: error.stack ?? null };
      if (typeof error === "string") return { message: error, stack: null };
      try {
        return { message: JSON.stringify(error), stack: null };
      } catch {
        return { message: String(error), stack: null };
      }
    };

    const toOptions = <T extends object>(arg: number | T | undefined): T => {
      if (typeof arg === "number") {
        return { ...(arg != null ? { afterTimestamp: arg } : {}) } as T;
      }
      return (arg ?? ({} as T)) as T;
    };

    const sliceLast = <T>(arr: T[], last?: number): T[] => {
      if (typeof last !== "number") return arr;
      if (last <= 0) return [];
      return arr.slice(-last);
    };

    return {
      recordLog(level, message, data, correlationId, sourceId) {
        logs.push({
          timestampMs: Date.now(),
          level,
          message,
          data,
          sourceId: sourceId,
          correlationId: correlationId ?? getCorrelationId() ?? null,
        });
        trim(logs);
      },
      getLogs(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          levels?: LogLevel[];
          messageIncludes?: string;
          correlationIds?: string[];
        }>(input);

        let result = [...logs];

        if (typeof options.afterTimestamp === "number") {
          result = result.filter(
            (l) => l.timestampMs > options.afterTimestamp!
          );
        }
        if (options.levels && options.levels.length > 0) {
          const allowed = new Set(options.levels);
          result = result.filter((l) => allowed.has(l.level));
        }
        if (options.messageIncludes) {
          result = result.filter((l) =>
            l.message.includes(options.messageIncludes!)
          );
        }
        if (options.correlationIds && options.correlationIds.length > 0) {
          const allowed = new Set(options.correlationIds.map(String));
          result = result.filter((l) => allowed.has(String(l.correlationId)));
        }
        return sliceLast(result, options.last);
      },
      recordEmission(eventId, payload, emitterId) {
        emissions.push({
          timestampMs: Date.now(),
          eventId,
          emitterId: emitterId ?? null,
          payload,
          correlationId: getCorrelationId(),
        });
        trim(emissions);
      },
      getEmissions(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          eventIds?: string[];
          emitterIds?: string[];
          correlationIds?: string[];
        }>(input);

        let result = [...emissions];
        if (typeof options.afterTimestamp === "number") {
          result = result.filter(
            (e) => e.timestampMs > options.afterTimestamp!
          );
        }
        if (options.eventIds && options.eventIds.length > 0) {
          const allowed = new Set(options.eventIds);
          result = result.filter((e) => allowed.has(e.eventId));
        }
        if (options.emitterIds && options.emitterIds.length > 0) {
          const allowed = new Set(options.emitterIds);
          result = result.filter(
            (e) => e.emitterId != null && allowed.has(String(e.emitterId))
          );
        }
        if (options.correlationIds && options.correlationIds.length > 0) {
          const allowed = new Set(options.correlationIds.map(String));
          result = result.filter((e) => allowed.has(String(e.correlationId)));
        }
        return sliceLast(result, options.last);
      },
      recordError(sourceId, sourceKind, error, data) {
        const { message, stack } = normalizeError(error);
        errors.push({
          timestampMs: Date.now(),
          sourceId,
          sourceKind,
          message,
          stack,
          data,
        });
        trim(errors);
      },
      getErrors(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          sourceKinds?: (
            | "TASK"
            | "HOOK"
            | "RESOURCE"
            | "MIDDLEWARE"
            | "INTERNAL"
          )[];
          sourceIds?: string[];
          messageIncludes?: string;
          correlationIds?: string[];
        }>(input);

        let result = [...errors];
        if (typeof options.afterTimestamp === "number") {
          result = result.filter(
            (e) => e.timestampMs > options.afterTimestamp!
          );
        }
        if (options.sourceKinds && options.sourceKinds.length > 0) {
          const allowed = new Set(options.sourceKinds);
          result = result.filter((e) => allowed.has(e.sourceKind));
        }
        if (options.sourceIds && options.sourceIds.length > 0) {
          const allowed = new Set(options.sourceIds.map(String));
          result = result.filter((e) => allowed.has(String(e.sourceId)));
        }
        if (options.messageIncludes) {
          result = result.filter((e) =>
            e.message.includes(options.messageIncludes!)
          );
        }
        if (options.correlationIds && options.correlationIds.length > 0) {
          const allowed = new Set(options.correlationIds.map(String));
          result = result.filter((e) => allowed.has(String(e.correlationId)));
        }
        return sliceLast(result, options.last);
      },
      recordRun(nodeId, nodeKind, durationMs, ok, error, parentId, rootId) {
        const errStr = (() => {
          if (error == null) return null;
          if (typeof error === "string") return error;
          if (error instanceof Error) return error.message;
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();
        runs.push({
          timestampMs: Date.now(),
          nodeId,
          nodeKind,
          durationMs,
          ok,
          error: errStr,
          parentId: parentId ?? null,
          rootId: rootId ?? null,
          correlationId: getCorrelationId(),
        });
        trim(runs);
      },
      getRuns(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          nodeKinds?: ("TASK" | "HOOK")[];
          nodeIds?: string[];
          ok?: boolean;
          parentIds?: string[];
          rootIds?: string[];
        }>(input);

        let result = [...runs];
        if (typeof options.afterTimestamp === "number") {
          result = result.filter(
            (r) => r.timestampMs > options.afterTimestamp!
          );
        }
        if (options.nodeKinds && options.nodeKinds.length > 0) {
          const allowed = new Set(options.nodeKinds);
          result = result.filter((r) => allowed.has(r.nodeKind));
        }
        if (options.nodeIds && options.nodeIds.length > 0) {
          const allowed = new Set(options.nodeIds.map(String));
          result = result.filter((r) => allowed.has(String(r.nodeId)));
        }
        if (typeof options.ok === "boolean") {
          result = result.filter((r) => r.ok === options.ok);
        }
        if (options.parentIds && options.parentIds.length > 0) {
          const allowed = new Set(options.parentIds.map(String));
          result = result.filter((r) => allowed.has(String(r.parentId)));
        }
        if (options.rootIds && options.rootIds.length > 0) {
          const allowed = new Set(options.rootIds.map(String));
          result = result.filter((r) => allowed.has(String(r.rootId)));
        }
        return sliceLast(result, options.last);
      },
    };
  },
  tags: [globals.tags.excludeFromGlobalHooks],
});

// const onGlobalEvent = hook({
//   id: "runner-dev.live.onEvent",
//   on: "*",
//   dependencies: {
//     liveService,
//   },
//   async run(event, { liveService }) {
//     // During very early init phases, liveService may not be ready
//     if (!liveService) return;
//     // Record full emission details
//     liveService.recordEmission(
//       String(event.id),
//       event.data,
//       typeof event.source === "string" ? event.source : String(event.source)
//     );
//   },
// });

export const live = resource({
  id: "runner-dev.resources.live",
  dependencies: {
    liveService,
    logger: globals.resources.logger,
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
        log.data,
        correlationId,
        log.source
      );
    });

    return liveService;
  },
});
