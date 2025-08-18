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

import type { Hook, Task } from "../model";
import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { ResourceType } from "./ResourceType";
import { AllType } from "./AllType";
import { EventType } from "./EventType";
import { MiddlewareType } from "./MiddlewareType";
import type { GraphQLFieldConfigMap } from "graphql";
import type { CustomGraphQLContext } from "../context";
import { baseElementCommonFields } from "./BaseElementCommon";
import { taskLikeCommonFields } from "./TaskLikeCommon";
import { definitions } from "@bluelibs/runner";
import { sanitizePath } from "../../utils/path";

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
  description:
    "Common fields for Task and Listener. These nodes are executable via Runner and can emit events, depend on resources and be wrapped by middleware.",
  interfaces: [BaseElementInterface],
  fields: () => ({
    id: { description: "Task id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Task metadata", type: MetaType },
    filePath: {
      description: "Path to task file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    fileContents: {
      description:
        "Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine.",
      type: GraphQLString,
      args: {
        startLine: {
          description: "1-based inclusive start line",
          type: GraphQLInt,
        },
        endLine: {
          description: "1-based inclusive end line",
          type: GraphQLInt,
        },
      },
    },
    markdownDescription: {
      description:
        "Markdown composed from meta.title and meta.description (if present)",
      type: new GraphQLNonNull(GraphQLString),
    },
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
      description:
        "Id of the resource that overrides this task (if any). Overriding replaces registrations at runtime.",
      type: GraphQLString,
    },
    depenendsOnResolved: {
      description:
        "Flattened dependencies resolved to All (tasks, listeners, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        const { tasks, listeners, resources } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...listeners, ...resources];
      },
    },
    registeredBy: {
      description:
        "Id of the resource that registered this task (if any). Useful to trace provenance.",
      type: GraphQLString,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        if ((node as any).registeredBy) return (node as any).registeredBy;
        const allResources = ctx.introspector.getResources();
        const found = allResources.find((r) =>
          (r.registers || []).includes(node.id)
        );
        return found?.id ?? null;
      },
    },
    registeredByResolved: {
      description: "Resource that registered this task (resolved, if any)",
      type: ResourceType,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        if ((node as any).registeredBy) {
          return ctx.introspector.getResource((node as any).registeredBy);
        }
        // Fallback for backward-compatibility
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r) => (r.registers || []).includes(node.id)) ||
          null
        );
      },
    },
  }),
  resolveType: (value) => {
    const node = value as Task | Hook;
    return typeof (node as Hook).event === "string" ? "Listener" : "Task";
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
    filePath: {
      description: "Path to task file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    ...taskLikeCommonFields({
      ResourceType,
      TaskMiddlewareUsageType,
      middlewareDetailedResolver: (node, _args, ctx: CustomGraphQLContext) => {
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
    }),
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
    depenendsOnResolved: {
      description:
        "Flattened dependencies resolved to All (tasks, listeners, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        const { tasks, listeners, resources } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...listeners, ...resources];
      },
    },
    ...baseElementCommonFields(),
  }),
});

export const ListenerType = new GraphQLObjectType({
  name: "Listener",
  interfaces: [TaskInterface, BaseElementInterface],
  isTypeOf: (value) => typeof (value as any)?.event === "string",
  fields: () => ({
    id: { description: "Listener id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Listener metadata", type: MetaType },
    filePath: {
      description: "Path to listener file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    emits: {
      description: "Event ids this listener may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    ...taskLikeCommonFields({
      ResourceType,
      TaskMiddlewareUsageType,
    }),
    event: {
      description: "The event id this listener listens to",
      type: new GraphQLNonNull(GraphQLString),
    },
    listenerOrder: {
      description: "Execution order among listeners for the same event",
      type: GraphQLInt,
    },
    depenendsOnResolved: {
      description:
        "Flattened dependencies resolved to All (tasks, listeners, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node: Hook, _args, ctx: CustomGraphQLContext) => {
        const { tasks, listeners, resources } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...listeners, ...resources];
      },
    },
    ...baseElementCommonFields(),
  }),
});
