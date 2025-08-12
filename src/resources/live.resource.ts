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

export interface Live {
  getLogs(afterTimestamp?: number): LogEntry[];
  getEmissions(afterTimestamp?: number): EmissionEntry[];
  getErrors(afterTimestamp?: number): ErrorEntry[];
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
}

const liveService = resource({
  id: "runner-dev.live.inner",
  async init(c: { maxEntries?: number }): Promise<Live> {
    const maxEntries = c?.maxEntries ?? 10000;
    const logs: LogEntry[] = [];
    const emissions: EmissionEntry[] = [];
    const errors: ErrorEntry[] = [];
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

    return {
      recordLog(level, message, data) {
        logs.push({ timestampMs: Date.now(), level, message, data });
        trim(logs);
      },
      getLogs(afterTimestamp) {
        return typeof afterTimestamp === "number"
          ? logs.filter((l) => l.timestampMs > afterTimestamp)
          : [...logs];
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
      getEmissions(afterTimestamp) {
        return typeof afterTimestamp === "number"
          ? emissions.filter((e) => e.timestampMs > afterTimestamp)
          : [...emissions];
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
      getErrors(afterTimestamp) {
        return typeof afterTimestamp === "number"
          ? errors.filter((e) => e.timestampMs > afterTimestamp)
          : [...errors];
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
