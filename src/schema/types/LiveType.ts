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

import type { CustomGraphQLContext } from "../../graphql/context";
import type { LogLevel } from "../../resources/live.resource";

// Strongly-typed resolver args
type LogFilterArgs = {
  levels?: LogLevel[] | null;
  messageIncludes?: string | null;
} | null;

type LogsArgs = {
  afterTimestamp?: number | null;
  last?: number | null;
  filter?: LogFilterArgs;
};

type EmissionFilterArgs = {
  eventIds?: string[] | null;
  emitterIds?: string[] | null;
} | null;

type EmissionsArgs = {
  afterTimestamp?: number | null;
  last?: number | null;
  filter?: EmissionFilterArgs;
};

type SourceKind = "TASK" | "LISTENER" | "RESOURCE" | "MIDDLEWARE" | "INTERNAL";
type NodeKind = "TASK" | "LISTENER";

type ErrorFilterArgs = {
  sourceKinds?: SourceKind[] | null;
  sourceIds?: (string | number)[] | null;
  messageIncludes?: string | null;
} | null;

type ErrorsArgs = {
  afterTimestamp?: number | null;
  last?: number | null;
  filter?: ErrorFilterArgs;
};

type RunFilterArgs = {
  nodeKinds?: NodeKind[] | null;
  nodeIds?: string[] | null;
  ok?: boolean | null;
} | null;

type RunsArgs = {
  afterTimestamp?: number | null;
  last?: number | null;
  filter?: RunFilterArgs;
};

export const LogEntryType = new GraphQLObjectType({
  name: "LogEntry",
  fields: () => ({
    timestampMs: { type: new GraphQLNonNull(GraphQLFloat) },
    level: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    data: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node: any) =>
        node?.data == null
          ? null
          : typeof node.data === "string"
          ? node.data
          : safeStringify(node.data),
    },
  }),
});

export const EmissionEntryType = new GraphQLObjectType({
  name: "EmissionEntry",
  fields: () => ({
    timestampMs: { type: new GraphQLNonNull(GraphQLFloat) },
    eventId: { type: new GraphQLNonNull(GraphQLString) },
    emitterId: { type: GraphQLString },
    payload: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node: any) =>
        node?.payload == null
          ? null
          : typeof node.payload === "string"
          ? node.payload
          : safeStringify(node.payload),
    },
  }),
});

export const ErrorEntryType = new GraphQLObjectType({
  name: "ErrorEntry",
  fields: () => ({
    timestampMs: { type: new GraphQLNonNull(GraphQLFloat) },
    sourceId: { type: new GraphQLNonNull(GraphQLID) },
    sourceKind: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    stack: { type: GraphQLString },
    data: {
      description: "Stringified JSON if object",
      type: GraphQLString,
      resolve: (node: any) =>
        node?.data == null
          ? null
          : typeof node.data === "string"
          ? node.data
          : safeStringify(node.data),
    },
  }),
});

export const RunRecordType = new GraphQLObjectType({
  name: "RunRecord",
  fields: () => ({
    timestampMs: { type: new GraphQLNonNull(GraphQLFloat) },
    nodeId: { type: new GraphQLNonNull(GraphQLString) },
    nodeKind: { type: new GraphQLNonNull(GraphQLString) },
    durationMs: { type: new GraphQLNonNull(GraphQLFloat) },
    ok: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
  }),
});

export const LiveType = new GraphQLObjectType<unknown, CustomGraphQLContext>({
  name: "Live",
  fields: () => ({
    logs: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: LogFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(LogEntryType))
      ),
      resolve: (_root, args: LogsArgs, ctx) => {
        if (
          args?.last == null &&
          (args?.filter == null || Object.keys(args.filter).length === 0)
        ) {
          // Preserve backward-compat fast-path when only afterTimestamp is used
          return ctx.live.getLogs(args?.afterTimestamp ?? undefined);
        }
        return ctx.live.getLogs({
          afterTimestamp: args?.afterTimestamp ?? undefined,
          last: args?.last ?? undefined,
          levels: args?.filter?.levels ?? undefined,
          messageIncludes: args?.filter?.messageIncludes ?? undefined,
        });
      },
    },
    emissions: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: EmissionFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(EmissionEntryType))
      ),
      resolve: (_root, args: EmissionsArgs, ctx) => {
        if (
          args?.last == null &&
          (args?.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getEmissions(args?.afterTimestamp ?? undefined);
        }
        return ctx.live.getEmissions({
          afterTimestamp: args?.afterTimestamp ?? undefined,
          last: args?.last ?? undefined,
          eventIds: args?.filter?.eventIds ?? undefined,
          emitterIds: args?.filter?.emitterIds ?? undefined,
        });
      },
    },
    errors: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: ErrorFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ErrorEntryType))
      ),
      resolve: (_root, args: ErrorsArgs, ctx) => {
        if (
          args?.last == null &&
          (args?.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getErrors(args?.afterTimestamp ?? undefined);
        }
        return ctx.live.getErrors({
          afterTimestamp: args?.afterTimestamp ?? undefined,
          last: args?.last ?? undefined,
          sourceKinds: args?.filter?.sourceKinds ?? undefined,
          sourceIds: (args?.filter?.sourceIds as any) ?? undefined,
          messageIncludes: args?.filter?.messageIncludes ?? undefined,
        });
      },
    },
    runs: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
        last: { type: GraphQLInt },
        filter: { type: RunFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(RunRecordType))
      ),
      resolve: (_root, args: RunsArgs, ctx) => {
        if (
          args?.last == null &&
          (args?.filter == null || Object.keys(args.filter).length === 0)
        ) {
          return ctx.live.getRuns(args?.afterTimestamp ?? undefined);
        }
        return ctx.live.getRuns({
          afterTimestamp: args?.afterTimestamp ?? undefined,
          last: args?.last ?? undefined,
          nodeKinds: args?.filter?.nodeKinds ?? undefined,
          nodeIds: args?.filter?.nodeIds ?? undefined,
          ok: args?.filter?.ok ?? undefined,
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
  values: {
    TASK: { value: "TASK" },
    LISTENER: { value: "LISTENER" },
  },
});

export const LogFilterInput = new GraphQLInputObjectType({
  name: "LogFilterInput",
  fields: {
    levels: { type: new GraphQLList(new GraphQLNonNull(LogLevelEnum)) },
    messageIncludes: { type: GraphQLString },
  },
});

export const EmissionFilterInput = new GraphQLInputObjectType({
  name: "EmissionFilterInput",
  fields: {
    eventIds: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    emitterIds: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
  },
});

export const ErrorFilterInput = new GraphQLInputObjectType({
  name: "ErrorFilterInput",
  fields: {
    sourceKinds: { type: new GraphQLList(new GraphQLNonNull(SourceKindEnum)) },
    sourceIds: { type: new GraphQLList(new GraphQLNonNull(GraphQLID)) },
    messageIncludes: { type: GraphQLString },
  },
});

export const RunFilterInput = new GraphQLInputObjectType({
  name: "RunFilterInput",
  fields: {
    nodeKinds: { type: new GraphQLList(new GraphQLNonNull(NodeKindEnum)) },
    nodeIds: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    ok: { type: GraphQLBoolean },
  },
});
