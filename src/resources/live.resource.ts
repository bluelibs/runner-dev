import { globals, resource, task } from "@bluelibs/runner";

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
  data?: unknown;
}
export interface EmissionEntry {
  timestampMs: number;
  eventId: string;
  emitterId?: string | null;
  payload?: unknown;
}

export interface ErrorEntry {
  timestampMs: number;
  sourceId: string;
  sourceKind: "TASK" | "LISTENER" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL";
  message: string;
  stack?: string | null;
  data?: unknown;
}

export interface RunRecord {
  timestampMs: number;
  nodeId: string;
  nodeKind: "TASK" | "LISTENER";
  durationMs: number;
  ok: boolean;
  error?: string | null;
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
            | "LISTENER"
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
          nodeKinds?: ("TASK" | "LISTENER")[];
          nodeIds?: string[];
          ok?: boolean;
        }
  ): RunRecord[];
  recordLog(level: LogLevel, message: string, data?: unknown): void;
  recordEmission(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): void;
  recordError(
    sourceId: string,
    sourceKind: "TASK" | "LISTENER" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL",
    error: unknown,
    data?: unknown
  ): void;
  recordRun(
    nodeId: string,
    nodeKind: "TASK" | "LISTENER",
    durationMs: number,
    ok: boolean,
    error?: unknown
  ): void;
}

const liveService = resource({
  id: "runner-dev.live.inner",
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
      recordLog(level, message, data) {
        logs.push({ timestampMs: Date.now(), level, message, data });
        trim(logs);
      },
      getLogs(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          levels?: LogLevel[];
          messageIncludes?: string;
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
        return sliceLast(result, options.last);
      },
      recordEmission(eventId, payload, emitterId) {
        emissions.push({
          timestampMs: Date.now(),
          eventId,
          emitterId: emitterId ?? null,
          payload,
        });
        trim(emissions);
      },
      getEmissions(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          eventIds?: string[];
          emitterIds?: string[];
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
            | "LISTENER"
            | "RESOURCE"
            | "MIDDLEWARE"
            | "INTERNAL"
          )[];
          sourceIds?: string[];
          messageIncludes?: string;
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
        return sliceLast(result, options.last);
      },
      recordRun(nodeId, nodeKind, durationMs, ok, error) {
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
        });
        trim(runs);
      },
      getRuns(input) {
        const options = toOptions<{
          afterTimestamp?: number;
          last?: number;
          nodeKinds?: ("TASK" | "LISTENER")[];
          nodeIds?: string[];
          ok?: boolean;
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
        return sliceLast(result, options.last);
      },
    };
  },
});

const onLog = task({
  id: "runner-dev.live.onLog",
  on: globals.events.log,
  dependencies: {
    liveService,
  },
  async run(event, { liveService }) {
    const log = event.data;
    liveService.recordLog(log.level as LogLevel, log.message, log.data);
  },
});

const onEvent = task({
  id: "runner-dev.live.onEvent",
  on: "*",
  dependencies: {
    liveService,
  },
  async run(event, { liveService }) {
    // During very early init phases, liveService may not be ready
    if (!liveService) return;
    // Record full emission details
    liveService.recordEmission(
      String(event.id),
      event.data,
      typeof event.source === "string" ? event.source : String(event.source)
    );
  },
});

const onTaskError = task({
  id: "runner-dev.live.onTaskError",
  on: globals.events.tasks.onError,
  dependencies: { liveService },
  async run(event, { liveService }) {
    if (!liveService) return;
    const err = event.data.error;
    const taskDef = event.data.task;
    const taskId = String(taskDef.id);
    liveService.recordError(taskId, "TASK", err);
  },
});

const onResourceError = task({
  id: "runner-dev.live.onResourceError",
  on: globals.events.resources.onError,
  dependencies: { liveService },
  async run(event, { liveService }) {
    if (!liveService) return;
    const err = event.data.error;
    const resourceDef = event.data.resource;
    const resourceId = String(resourceDef.id);
    liveService.recordError(resourceId, "RESOURCE", err);
  },
});

export const live = resource({
  id: "runner-dev.live",
  dependencies: { liveService },
  register: [liveService, onLog, onEvent, onTaskError, onResourceError],
  async init(_config: unknown, { liveService }) {
    return liveService;
  },
});
