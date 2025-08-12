import {
  GraphQLFloat,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

import type { CustomGraphQLContext } from "../../graphql/context";

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

export const LiveType = new GraphQLObjectType<unknown, CustomGraphQLContext>({
  name: "Live",
  fields: () => ({
    logs: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(LogEntryType))
      ),
      resolve: (_root, args, ctx) => {
        return ctx.live.getLogs(args?.afterTimestamp ?? undefined);
      },
    },
    emissions: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(EmissionEntryType))
      ),
      resolve: (_root, args, ctx) => {
        return ctx.live.getEmissions(args?.afterTimestamp ?? undefined);
      },
    },
    errors: {
      args: {
        afterTimestamp: { type: GraphQLFloat },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ErrorEntryType))
      ),
      resolve: (_root, args, ctx) => {
        return ctx.live.getErrors(args?.afterTimestamp ?? undefined);
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
