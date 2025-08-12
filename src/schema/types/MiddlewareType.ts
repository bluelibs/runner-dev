import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { BaseElementInterface, MetaType } from "./AllType";
import { TaskInterface } from "./TaskType";
import { EventType } from "./EventType";
import { ResourceType } from "./ResourceType";

export const MiddlewareGlobalType: GraphQLObjectType = new GraphQLObjectType({
  name: "GlobalMiddleware",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    enabled: {
      description: "Whether the middleware is active globally",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    tasks: {
      description: "Ids of tasks to which the middleware is attached globally",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    resources: {
      description:
        "Ids of resources to which the middleware is attached globally",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
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
