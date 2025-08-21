import {
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import type { RunRecord as LiveRunRecord } from "../../resources/live.resource";
import { BaseElementInterface } from "./AllType";

export const NodeKindEnum = new GraphQLEnumType({
  name: "NodeKindEnum",
  description: "Kinds of executable nodes",
  values: {
    TASK: { value: "TASK" },
    HOOK: { value: "HOOK" },
  },
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
      description: "Resolved executed node (task/hook)",
      type: BaseElementInterface,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        const id = String(node.nodeId);
        if (node.nodeKind === "TASK") {
          return ctx.introspector.getTask(id);
        } else if (node.nodeKind === "HOOK") {
          return ctx.introspector.getHook(id);
        }
        return null;
      },
    },
  }),
});

// We keep RunFilterInput definition here to reuse across Live/Task/Hook
import { GraphQLInputObjectType } from "graphql";

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
