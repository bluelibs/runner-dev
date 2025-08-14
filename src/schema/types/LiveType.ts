import {
  GraphQLFloat,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import type {
  LiveLogsArgs,
  LiveEmissionsArgs,
  LiveErrorsArgs,
  LiveRunsArgs,
} from "../../generated/resolvers-types";
import type {
  LogEntry as LiveLogEntry,
  EmissionEntry as LiveEmissionEntry,
  ErrorEntry as LiveErrorEntry,
  RunRecord as LiveRunRecord,
} from "../../resources/live.resource";
import { AllType, BaseElementInterface } from "./AllType";
import { TaskInterface } from "./TaskType";
import { EventType } from "./EventType";
import * as os from "node:os";
import {
  monitorEventLoopDelay,
  performance,
  PerformanceObserver,
  type EventLoopUtilization,
} from "node:perf_hooks";

export const LogEntryType = new GraphQLObjectType<
  LiveLogEntry,
  CustomGraphQLContext
>({
  name: "LogEntry",
  fields: () => ({
    timestampMs: {
      description: "Log creation time (milliseconds since epoch)",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    level: {
      description: "Log level",
      type: new GraphQLNonNull(LogLevelEnum),
    },
    message: {
      description: "Log message",
      type: new GraphQLNonNull(GraphQLString),
    },
    data: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node) =>
        node?.data == null
          ? null
          : typeof node.data === "string"
          ? node.data
          : safeStringify(node.data),
    },
    correlationId: {
      description: "Correlation id for tracing",
      type: GraphQLString,
    },
  }),
});

export const EmissionEntryType = new GraphQLObjectType<
  LiveEmissionEntry,
  CustomGraphQLContext
>({
  name: "EmissionEntry",
  fields: () => ({
    timestampMs: {
      description: "Emission time (milliseconds since epoch)",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    eventId: {
      description: "Emitted event id",
      type: new GraphQLNonNull(GraphQLString),
    },
    emitterId: {
      description: "Emitter id when available",
      type: GraphQLString,
    },
    payload: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node) =>
        node?.payload == null
          ? null
          : typeof node.payload === "string"
          ? node.payload
          : safeStringify(node.payload),
    },
    correlationId: {
      description: "Correlation id for tracing",
      type: GraphQLString,
    },
    eventResolved: {
      description: "Resolved event from eventId",
      type: EventType,
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEvent(String(node.eventId)),
    },
    emitterResolved: {
      description:
        "Resolved emitter node (task/listener/resource/middleware) if known; otherwise returns a minimal All node",
      type: BaseElementInterface,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        const id = node?.emitterId ? String(node.emitterId) : null;
        if (!id) return null;
        return (
          ctx.introspector.getTask(id) ||
          ctx.introspector.getListenersByIds([id])[0] ||
          ctx.introspector.getResource(id) ||
          ctx.introspector.getMiddleware(id) ||
          ctx.introspector.getEvent(id) || { id, meta: null, filePath: null }
        );
      },
    },
  }),
});

export const ErrorEntryType = new GraphQLObjectType<
  LiveErrorEntry,
  CustomGraphQLContext
>({
  name: "ErrorEntry",
  fields: () => ({
    timestampMs: {
      description: "Error time (milliseconds since epoch)",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    sourceId: {
      description: "Id of the source that emitted the error",
      type: new GraphQLNonNull(GraphQLID),
    },
    sourceKind: {
      description:
        "Kind of source (task/listener/resource/middleware/internal)",
      type: new GraphQLNonNull(SourceKindEnum),
    },
    message: {
      description: "Error message",
      type: new GraphQLNonNull(GraphQLString),
    },
    stack: { description: "Error stack when available", type: GraphQLString },
    data: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node) =>
        node?.data == null
          ? null
          : typeof node.data === "string"
          ? node.data
          : safeStringify(node.data),
    },
    correlationId: {
      description: "Correlation id for tracing",
      type: GraphQLString,
    },
    sourceResolved: {
      description:
        "Resolved source node (task/listener/resource/middleware), else minimal All",
      type: BaseElementInterface,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        const id = String(node.sourceId);
        switch (node.sourceKind) {
          case "TASK":
            return (
              ctx.introspector.getTask(id) || {
                id,
                meta: null,
                filePath: null,
              }
            );
          case "LISTENER":
            return (
              ctx.introspector.getListenersByIds([id])[0] || {
                id,
                meta: null,
                filePath: null,
              }
            );
          case "RESOURCE":
            return (
              ctx.introspector.getResource(id) || {
                id,
                meta: null,
                filePath: null,
              }
            );
          case "MIDDLEWARE":
            return (
              ctx.introspector.getMiddleware(id) || {
                id,
                meta: null,
                filePath: null,
              }
            );
          default:
            return { id, meta: null, filePath: null };
        }
      },
    },
  }),
});

export const RunRecordType = new GraphQLObjectType<
  LiveRunRecord,
  CustomGraphQLContext
>({
  name: "RunRecord",
  fields: () => ({
    timestampMs: {
      description: "Run end time (milliseconds since epoch)",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    nodeId: {
      description: "Id of the executed node",
      type: new GraphQLNonNull(GraphQLString),
    },
    nodeKind: {
      description: "Kind of executed node",
      type: new GraphQLNonNull(NodeKindEnum),
    },
    durationMs: {
      description: "Execution duration in milliseconds",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    ok: {
      description: "Whether execution succeeded",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    error: { description: "Error message (if failed)", type: GraphQLString },
    parentId: {
      description: "Immediate parent caller id if available",
      type: GraphQLString,
    },
    rootId: {
      description: "Root caller id that initiated the chain",
      type: GraphQLString,
    },
    correlationId: {
      description: "Correlation id for tracing",
      type: GraphQLString,
    },
    nodeResolved: {
      description: "Resolved task/listener node",
      type: TaskInterface,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        const id = String(node.nodeId);
        return (
          ctx.introspector.getTask(id) ||
          ctx.introspector.getListenersByIds([id])[0] ||
          null
        );
      },
    },
  }),
});

// System health types
type MemoryStats = { heapUsed: number; heapTotal: number; rss: number };
type CpuStats = { usage: number; loadAverage: number };
type EventLoopStats = { lag: number };
type GcStats = { collections: number; duration: number };

// Event loop delay histogram (nanoseconds)
const __eventLoopDelayHistogram = (() => {
  try {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    return h;
  } catch {
    return undefined;
  }
})();

// GC observer to aggregate stats since process start
let __gcCollections = 0;
let __gcDurationMs = 0;
const __gcEvents: { ts: number; duration: number }[] = [];
const __gcEventsMax = 10000;
function pushGcEvent(duration: number) {
  __gcEvents.push({ ts: Date.now(), duration });
  if (__gcEvents.length > __gcEventsMax) {
    // Trim 10% oldest to amortize cost
    __gcEvents.splice(0, Math.floor(__gcEventsMax * 0.1));
  }
}
try {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      __gcCollections += 1;
      __gcDurationMs += entry.duration;
      pushGcEvent(entry.duration);
    }
  });
  // buffered picks up prior GC entries as well
  obs.observe({ entryTypes: ["gc"], buffered: true });
} catch {
  // noop if unsupported
}

let __prevElu: EventLoopUtilization | undefined = undefined;
function getCpuEluUtilization(): number {
  try {
    const current = performance.eventLoopUtilization(__prevElu as any);
    __prevElu = current;
    return Number.isFinite(current.utilization) ? current.utilization : 0;
  } catch {
    return 0;
  }
}

export const MemoryStatsType = new GraphQLObjectType<
  MemoryStats,
  CustomGraphQLContext
>({
  name: "MemoryStats",
  fields: () => ({
    heapUsed: {
      description: "V8 heap used in bytes",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    heapTotal: {
      description: "V8 heap total in bytes",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    rss: {
      description: "Resident Set Size in bytes",
      type: new GraphQLNonNull(GraphQLFloat),
    },
  }),
});

export const CpuStatsType = new GraphQLObjectType<
  CpuStats,
  CustomGraphQLContext
>({
  name: "CpuStats",
  fields: () => ({
    usage: {
      description:
        "Event loop utilization ratio (0..1) since last sample or process start",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    loadAverage: {
      description: "System 1-minute load average",
      type: new GraphQLNonNull(GraphQLFloat),
    },
  }),
});

export const EventLoopStatsType = new GraphQLObjectType<
  EventLoopStats,
  CustomGraphQLContext
>({
  name: "EventLoopStats",
  fields: () => ({
    lag: {
      description:
        "Average event loop delay (ms) measured via monitorEventLoopDelay",
      type: new GraphQLNonNull(GraphQLFloat),
    },
  }),
});

export const GcStatsType = new GraphQLObjectType<GcStats, CustomGraphQLContext>(
  {
    name: "GcStats",
    fields: () => ({
      collections: {
        description: "Number of GC cycles since process start",
        type: new GraphQLNonNull(GraphQLInt),
      },
      duration: {
        description: "Total time spent in GC (ms) since process start",
        type: new GraphQLNonNull(GraphQLFloat),
      },
    }),
  }
);

export const LiveType = new GraphQLObjectType<unknown, CustomGraphQLContext>({
  name: "Live",
  description:
    "Real-time telemetry access: logs, event emissions, errors, runs, and system health.",
  fields: () => ({
    memory: {
      description: "Process memory usage",
      type: new GraphQLNonNull(MemoryStatsType),
      resolve: () => {
        const m = process.memoryUsage();
        const node: MemoryStats = {
          heapUsed: m.heapUsed,
          heapTotal: m.heapTotal,
          rss: m.rss,
        };
        return node;
      },
    },
    cpu: {
      description: "CPU-related statistics",
      type: new GraphQLNonNull(CpuStatsType),
      resolve: () => {
        const node: CpuStats = {
          usage: getCpuEluUtilization(),
          loadAverage: os.loadavg()[0] ?? 0,
        };
        return node;
      },
    },
    eventLoop: {
      description: "Event loop statistics",
      args: {
        reset: {
          description:
            "Reset accumulated event loop delay histogram after read",
          type: GraphQLBoolean,
        },
      },
      type: new GraphQLNonNull(EventLoopStatsType),
      resolve: (_root, args: { reset?: boolean }) => {
        const meanNs = __eventLoopDelayHistogram?.mean ?? 0;
        const node: EventLoopStats = {
          lag: Number.isFinite(meanNs) ? meanNs / 1e6 : 0,
        };
        if (args?.reset) {
          try {
            __eventLoopDelayHistogram?.reset();
          } catch {
            // ignore
          }
        }
        return node;
      },
    },
    gc: {
      description:
        "Garbage collector statistics. By default totals since process start; when windowMs provided, returns stats within that window.",
      args: {
        windowMs: {
          description:
            "Optional window in milliseconds to compute stats over recent period.",
          type: GraphQLFloat,
        },
      },
      type: new GraphQLNonNull(GcStatsType),
      resolve: (_root, args: { windowMs?: number }) => {
        const w = args?.windowMs;
        if (typeof w === "number" && w > 0) {
          const since = Date.now() - w;
          let collections = 0;
          let duration = 0;
          // __gcEvents is time-ordered; find first index >= since
          // Linear scan is fine for modest sizes
          for (let i = __gcEvents.length - 1; i >= 0; i--) {
            const ev = __gcEvents[i];
            if (ev.ts < since) break;
            collections += 1;
            duration += ev.duration;
          }
          return { collections, duration } as GcStats;
        }
        const node: GcStats = {
          collections: __gcCollections,
          duration: __gcDurationMs,
        };
        return node;
      },
    },
    logs: {
      description:
        "Live logs with optional timestamp cursor, filters and last N",
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: LogFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(LogEntryType))
      ),
      resolve: (_root, args: LiveLogsArgs, ctx) => {
        if (
          args.last == null &&
          (args.filter == null || Object.keys(args.filter).length === 0)
        ) {
          // Preserve backward-compat fast-path when only afterTimestamp is used
          return ctx.live.getLogs(args.afterTimestamp ?? undefined);
        }
        return ctx.live.getLogs({
          afterTimestamp: args.afterTimestamp ?? undefined,
          last: args.last ?? undefined,
          levels: args.filter?.levels ?? undefined,
          messageIncludes: args.filter?.messageIncludes ?? undefined,
          correlationIds: (args as any).filter?.correlationIds ?? undefined,
        });
      },
    },
    emissions: {
      description:
        "Event emissions with optional timestamp cursor, filters and last N",
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: EmissionFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(EmissionEntryType))
      ),
      resolve: (_root, args: LiveEmissionsArgs, ctx) => {
        if (
          args.last == null &&
          (args.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getEmissions(args.afterTimestamp ?? undefined);
        }
        return ctx.live.getEmissions({
          afterTimestamp: args.afterTimestamp ?? undefined,
          last: args.last ?? undefined,
          eventIds: args.filter?.eventIds ?? undefined,
          emitterIds: args.filter?.emitterIds ?? undefined,
        });
      },
    },
    errors: {
      description:
        "Errors captured with optional timestamp cursor, filters and last N",
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: ErrorFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ErrorEntryType))
      ),
      resolve: (_root, args: LiveErrorsArgs, ctx) => {
        if (
          args.last == null &&
          (args.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getErrors(args.afterTimestamp ?? undefined);
        }
        return ctx.live.getErrors({
          afterTimestamp: args.afterTimestamp ?? undefined,
          last: args.last ?? undefined,
          sourceKinds: args.filter?.sourceKinds ?? undefined,
          sourceIds: args.filter?.sourceIds ?? undefined,
          messageIncludes: args.filter?.messageIncludes ?? undefined,
        });
      },
    },
    runs: {
      description:
        "Execution run records with optional timestamp cursor, filters and last N",
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: RunFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(RunRecordType))
      ),
      resolve: (_root, args: LiveRunsArgs, ctx) => {
        if (
          args.last == null &&
          (args.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getRuns(args.afterTimestamp ?? undefined);
        }
        return ctx.live.getRuns({
          afterTimestamp: args.afterTimestamp ?? undefined,
          last: args.last ?? undefined,
          nodeKinds: args.filter?.nodeKinds ?? undefined,
          nodeIds: args.filter?.nodeIds ?? undefined,
          ok: args.filter?.ok ?? undefined,
          parentIds: (args as any).filter?.parentIds ?? undefined,
          rootIds: (args as any).filter?.rootIds ?? undefined,
        });
      },
    },
  }),
});

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Enums and filter inputs
export const LogLevelEnum = new GraphQLEnumType({
  name: "LogLevelEnum",
  description: "Supported log levels",
  values: {
    trace: { value: "trace" },
    debug: { value: "debug" },
    info: { value: "info" },
    warn: { value: "warn" },
    error: { value: "error" },
    fatal: { value: "fatal" },
    log: { value: "log" },
  },
});

export const SourceKindEnum = new GraphQLEnumType({
  name: "SourceKindEnum",
  description: "Kinds of sources that can emit errors",
  values: {
    TASK: { value: "TASK" },
    LISTENER: { value: "LISTENER" },
    RESOURCE: { value: "RESOURCE" },
    MIDDLEWARE: { value: "MIDDLEWARE" },
    INTERNAL: { value: "INTERNAL" },
  },
});

export const NodeKindEnum = new GraphQLEnumType({
  name: "NodeKindEnum",
  description: "Kinds of executable nodes",
  values: {
    TASK: { value: "TASK" },
    LISTENER: { value: "LISTENER" },
  },
});

export const LogFilterInput = new GraphQLInputObjectType({
  name: "LogFilterInput",
  description: "Filters for logs",
  fields: {
    levels: {
      description: "Only include specific levels",
      type: new GraphQLList(new GraphQLNonNull(LogLevelEnum)),
    },
    messageIncludes: {
      description: "Substring match inside message",
      type: GraphQLString,
    },
    correlationIds: {
      description: "Filter by correlation ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
  },
});

export const EmissionFilterInput = new GraphQLInputObjectType({
  name: "EmissionFilterInput",
  description: "Filters for event emissions",
  fields: {
    eventIds: {
      description: "Only include specific event ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    emitterIds: {
      description: "Only include specific emitter ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    correlationIds: {
      description: "Filter by correlation ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
  },
});

export const ErrorFilterInput = new GraphQLInputObjectType({
  name: "ErrorFilterInput",
  description: "Filters for captured errors",
  fields: {
    sourceKinds: {
      description: "Only include errors from specific source kinds",
      type: new GraphQLList(new GraphQLNonNull(SourceKindEnum)),
    },
    sourceIds: {
      description: "Only include errors from specific source ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLID)),
    },
    messageIncludes: {
      description: "Substring match inside error message",
      type: GraphQLString,
    },
    correlationIds: {
      description: "Filter by correlation ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
  },
});

export const RunFilterInput = new GraphQLInputObjectType({
  name: "RunFilterInput",
  description: "Filters for execution run records",
  fields: {
    nodeKinds: {
      description: "Only include specific node kinds",
      type: new GraphQLList(new GraphQLNonNull(NodeKindEnum)),
    },
    nodeIds: {
      description: "Only include specific node ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    ok: { description: "Filter by success status", type: GraphQLBoolean },
    parentIds: {
      description: "Only include runs with specific parent ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    rootIds: {
      description: "Only include runs with specific root ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    correlationIds: {
      description: "Filter by correlation ids",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
  },
});
