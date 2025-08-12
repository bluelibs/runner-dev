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

export interface Live {
  getLogs(afterTimestamp?: number): LogEntry[];
  getEmissions(afterTimestamp?: number): EmissionEntry[];
  recordLog(level: LogLevel, message: string, data?: unknown): void;
  recordEmission(
    eventId: string,
    payload?: unknown,
    emitterId?: string | null
  ): void;
}

const liveService = resource({
  id: "runner-dev.live.inner",
  async init(c: { maxEntries?: number }): Promise<Live> {
    const maxEntries = c?.maxEntries ?? 10000;
    const logs: LogEntry[] = [];
    const emissions: EmissionEntry[] = [];
    const trim = <T>(arr: T[]) => {
      const overflow = arr.length - maxEntries;
      if (overflow > 0) arr.splice(0, overflow);
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

export const live = resource({
  id: "runner-dev.live",
  dependencies: { liveService },
  register: [liveService, onLog, onEvent],
  async init(_config: unknown, { liveService }) {
    return liveService;
  },
});
