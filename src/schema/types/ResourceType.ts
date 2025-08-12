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
import { MiddlewareType } from "./MiddlewareType";
import { TaskInterface, TaskType } from "./TaskType";
import { EventType } from "./EventType";
import { CustomGraphQLContext } from "../../graphql/context";
import { TaskMiddlewareUsageType } from "./TaskType";
import { definitions } from "@bluelibs/runner";

export const ResourceType: GraphQLObjectType = new GraphQLObjectType({
  name: "Resource",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) =>
    Array.isArray((value as any)?.registers) &&
    Array.isArray((value as any)?.overrides),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Resource id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Resource metadata", type: MetaType },
    filePath: { description: "Path to resource file", type: GraphQLString },
    config: {
      description: "Serialized resource config (if any)",
      type: GraphQLString,
    },
    middleware: {
      description: "Ids of middlewares applied to this resource",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this resource (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getMiddlewaresByIds(node.middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this resource with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewareUsagesForResource(node.id),
    },
    overrides: {
      description: "Ids of items this resource overrides",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    overridesResolved: {
      description: "The registerable items this resource overrides (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        // We only have ids; return what we can resolve (tasks/listeners/resources/middleware)
        const ids: string[] = node.overrides;
        const tasks = ctx.introspector.getTasksByIds(ids);
        const listeners = ctx.introspector.getListenersByIds(ids);
        const resources = ctx.introspector.getResourcesByIds(ids);
        const middlewares = ctx.introspector.getMiddlewaresByIds(ids);
        return [...tasks, ...listeners, ...resources, ...middlewares];
      },
    },
    registers: {
      description: "Ids of items this resource registers",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    registersResolved: {
      description: "The items registered by this resource (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        const ids: string[] = node.registers;
        const tasks = ctx.introspector.getTasksByIds(ids);
        const listeners = ctx.introspector.getListenersByIds(ids);
        const resources = ctx.introspector.getResourcesByIds(ids);
        const middlewares = ctx.introspector.getMiddlewaresByIds(ids);
        const events = ctx.introspector.getEventsByIds(ids);
        return [
          ...tasks,
          ...listeners,
          ...resources,
          ...middlewares,
          ...events,
        ];
      },
    },
    usedBy: {
      description: "Task/listener nodes using this resource (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        return ctx.introspector.getTaskLikesUsingResource(node.id);
      },
    },
    emits: {
      description:
        "Events emitted by tasks/listeners that depend on this resource",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEmittedEventsForResource(node.id),
    },
    context: {
      description: "Serialized context (if any)",
      type: GraphQLString,
    },
  }),
});
