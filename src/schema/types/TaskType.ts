import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
} from "graphql";

import type { Listener, Task } from "../model";
import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { ResourceType } from "./ResourceType";
import { EventType } from "./EventType";
import { MiddlewareType } from "./MiddlewareType";
import type { GraphQLFieldConfigMap } from "graphql";
import type { CustomGraphQLContext } from "../../graphql/context";
import { definitions } from "@bluelibs/runner";

export const TaskMiddlewareUsageType = new GraphQLObjectType({
  name: "TaskMiddlewareUsage",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    config: { type: GraphQLString },
    node: { type: new GraphQLNonNull(MiddlewareType) },
  }),
});

export const TaskInterface = new GraphQLInterfaceType({
  name: "TaskInterface",
  description: "Common fields for Task and Listener",
  interfaces: [BaseElementInterface],
  fields: () => ({
    id: { description: "Task id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Task metadata", type: MetaType },
    filePath: { description: "Path to task file", type: GraphQLString },
    emits: {
      description: "Event ids this task may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    dependsOn: {
      description: "Ids of resources/tasks this task depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middleware: {
      description: "Ids of middlewares applied to this task",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this task (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getMiddlewaresByIds(node.middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this task with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewareUsagesForTaskLike(node.id),
    },

    emitsResolved: {
      description: "Events emitted by this task (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getEventsByIds(node.emits);
      },
    },
    overriddenBy: {
      description: "Id of the resource that overrides this task (if any)",
      type: GraphQLString,
    },
  }),
  resolveType: (value) => {
    const node = value as Task | Listener;
    return typeof (node as Listener).event === "string" ? "Listener" : "Task";
  },
});

export const TaskType = new GraphQLObjectType({
  name: "Task",
  interfaces: [TaskInterface, BaseElementInterface],
  isTypeOf: (value) =>
    Array.isArray((value as any)?.emits) &&
    Array.isArray((value as any)?.dependsOn) &&
    !("event" in (value as any)),
  fields: () => ({
    id: { description: "Task id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Task metadata", type: MetaType },
    filePath: { description: "Path to task file", type: GraphQLString },
    emits: {
      description: "Event ids this task may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    dependsOn: {
      description: "Ids of resources/tasks this task depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middleware: {
      description: "Ids of middlewares applied to this task",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this task (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getMiddlewaresByIds(node.middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this task with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        const storeTask = ctx.store?.tasks?.get(node.id)?.task as any;
        if (!storeTask) return [];
        return (storeTask.middleware || []).map((m: any) => ({
          id: String(m.id),
          config: m[definitions.symbolMiddlewareConfigured]
            ? JSON.stringify(m.config)
            : null,
          node: m,
        }));
      },
    },
    emitsResolved: {
      description: "Events emitted by this task (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getEventsByIds(node.emits);
      },
    },
    overriddenBy: {
      description: "Id of the resource that overrides this task (if any)",
      type: GraphQLString,
    },
    dependsOnResolved: {
      description: "Resolved dependencies and emitted events for this task",
      type: new GraphQLNonNull(
        new GraphQLObjectType({
          name: "TaskDependsOn",
          fields: () => ({
            tasks: {
              description: "Tasks this task depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(TaskInterface))
              ),
            },
            listeners: {
              description: "Listeners this task depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(TaskInterface))
              ),
            },
            resources: {
              description: "Resources this task depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(ResourceType))
              ),
            },
            emitters: {
              description: "Events this task emits",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(EventType))
              ),
            },
          }),
        })
      ),
      resolve: async (node, _args, ctx) => {
        const { tasks, listeners, resources, emitters } =
          await ctx.introspector.getDependencies(node);
        return { tasks, listeners, resources, emitters };
      },
    },
  }),
});

export const ListenerType = new GraphQLObjectType({
  name: "Listener",
  interfaces: [TaskInterface, BaseElementInterface],
  isTypeOf: (value) => typeof (value as any)?.event === "string",
  fields: () => ({
    id: { description: "Listener id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Listener metadata", type: MetaType },
    filePath: { description: "Path to listener file", type: GraphQLString },
    emits: {
      description: "Event ids this listener may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    emitsResolved: {
      description: "Events emitted by this listener (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getEventsByIds(node.emits);
      },
    },
    dependsOn: {
      description: "Ids of resources/tasks this listener depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middleware: {
      description: "Ids of middlewares applied to this listener",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this listener (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      resolve: async (node, _args, ctx) => {
        return ctx.introspector.getMiddlewaresByIds(node.middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this listener with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewareUsagesForTaskLike(node.id),
    },
    overriddenBy: {
      description: "Id of the resource that overrides this listener (if any)",
      type: GraphQLString,
    },
    event: {
      description: "The event id this listener listens to",
      type: new GraphQLNonNull(GraphQLString),
    },
    listenerOrder: {
      description: "Execution order among listeners for the same event",
      type: GraphQLInt,
    },
    dependsOnResolved: {
      description: "Resolved dependencies and emitted events for this listener",
      type: new GraphQLNonNull(
        new GraphQLObjectType({
          name: "ListenerDependsOn",
          fields: () => ({
            tasks: {
              description: "Tasks this listener depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(TaskInterface))
              ),
            },
            listeners: {
              description: "Listeners this listener depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(TaskInterface))
              ),
            },
            resources: {
              description: "Resources this listener depends on",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(ResourceType))
              ),
            },
            emitters: {
              description: "Events this listener emits",
              type: new GraphQLNonNull(
                new GraphQLList(new GraphQLNonNull(EventType))
              ),
            },
          }),
        })
      ),
      resolve: async (node, _args, ctx) => {
        const { tasks, listeners, resources, emitters } =
          await ctx.introspector.getDependencies(node);
        return { tasks, listeners, resources, emitters };
      },
    },
  }),
});
