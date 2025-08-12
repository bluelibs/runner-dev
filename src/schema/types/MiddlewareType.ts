import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { TaskInterface } from "./TaskType";
import { EventType } from "./EventType";
import { ResourceType } from "./ResourceType";
import { definitions } from "@bluelibs/runner";
import type { CustomGraphQLContext } from "../../graphql/context";

function safeStringify(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const MiddlewareTaskUsageType: GraphQLObjectType = new GraphQLObjectType(
  {
    name: "MiddlewareTaskUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLString },
      node: { type: new GraphQLNonNull(TaskInterface) },
    }),
  }
);

export const MiddlewareResourceUsageType: GraphQLObjectType =
  new GraphQLObjectType({
    name: "MiddlewareResourceUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLString },
      node: { type: new GraphQLNonNull(ResourceType) },
    }),
  });

export const MiddlewareGlobalType: GraphQLObjectType = new GraphQLObjectType({
  name: "GlobalMiddleware",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    enabled: {
      description: "Whether the middleware is active globally",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    tasks: {
      description: "Globally enabled for tasks",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    resources: {
      description: "Globally enabled for resources",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  }),
});

export const MiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "Middleware",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) =>
    Boolean((value as any)?.usedByTasks && (value as any)?.usedByResources),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Middleware id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Middleware metadata", type: MetaType },
    filePath: { description: "Path to middleware file", type: GraphQLString },
    global: {
      description: "Global middleware configuration",
      type: MiddlewareGlobalType,
    },
    usedByTasks: {
      description: "Ids of task/listener nodes that use this middleware",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    usedByTasksResolved: {
      description: "Task/listener nodes that use this middleware (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskInterface))
      ),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getTaskLikesUsingMiddleware(node.id),
    },
    usedByResources: {
      description: "Ids of resources that use this middleware",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    usedByResourcesResolved: {
      description: "Resources that use this middleware (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getResourcesByIds(node.usedByResources),
    },
    usedByTasksDetailed: {
      description: "Detailed task/listener usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareTaskUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTaskLikesUsingMiddlewareDetailed(String(node.id)),
    },
    usedByResourcesDetailed: {
      description: "Detailed resource usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareResourceUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResourcesUsingMiddlewareDetailed(String(node.id)),
    },
    emits: {
      description:
        "Events emitted by task/listener nodes that use this middleware",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getMiddlewareEmittedEvents(node.id),
    },
    overriddenBy: {
      description: "Id of the resource that overrides this middleware (if any)",
      type: GraphQLString,
    },
  }),
});
