import {
  GraphQLBoolean,
  GraphQLID,
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
import { EventType } from "./EventType";
import { TaskMiddlewareType } from "./MiddlewareType";
import { HookType } from "./HookType";
import type { GraphQLFieldConfigMap } from "graphql";
import type { CustomGraphQLContext } from "../context";
import { baseElementCommonFields } from "./BaseElementCommon";
// Removed taskLikeCommonFields, fields are declared explicitly for clarity
import { sanitizePath } from "../../utils/path";
import { convertJsonSchemaToReadable } from "../../utils/zod";
import { RunRecordType, RunFilterInput } from "./RunTypes";
import { DurableFlowShapeType } from "./DurableFlowTypes";
import { describeDurableTaskFromStore } from "../../resources/models/durable.runtime";

// Extracted to avoid inline self-referential initializer issues
export const TaskDependsOnType: GraphQLObjectType<
  { tasks: Task[]; hooks: Hook[]; resources: any[]; emitters: any[] },
  CustomGraphQLContext
> = new GraphQLObjectType<
  { tasks: Task[]; hooks: Hook[]; resources: any[]; emitters: any[] },
  CustomGraphQLContext
>({
  name: "TaskDependsOn",
  fields: (): GraphQLFieldConfigMap<
    { tasks: Task[]; hooks: Hook[]; resources: any[]; emitters: any[] },
    CustomGraphQLContext
  > => ({
    tasks: {
      description: "Tasks this task depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: (obj: any) =>
        Array.isArray(obj?.tasks)
          ? obj.tasks.filter((n: any) => !("event" in (n || {})))
          : [],
    },
    hooks: {
      description: "Hooks this task depends on",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(HookType))),
      resolve: (obj: any) =>
        Array.isArray(obj?.hooks)
          ? obj.hooks.filter((n: any) => "event" in (n || {}))
          : [],
    },
    resources: {
      description: "Resources this task depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: (obj: any) =>
        Array.isArray(obj?.resources) ? obj.resources : [],
    },
    emitters: {
      description: "Events this task emits",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (obj: any) => (Array.isArray(obj?.emitters) ? obj.emitters : []),
    },
  }),
});

export const TaskMiddlewareUsageType = new GraphQLObjectType({
  name: "TaskMiddlewareUsage",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    config: { type: GraphQLString },
    node: { type: new GraphQLNonNull(TaskMiddlewareType) },
  }),
});

export const TaskType = new GraphQLObjectType<Task, CustomGraphQLContext>({
  name: "Task",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value: unknown) =>
    Array.isArray((value as any)?.emits) &&
    Array.isArray((value as any)?.dependsOn) &&
    !("event" in (value as any)),
  fields: (): GraphQLFieldConfigMap<Task, CustomGraphQLContext> => ({
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
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareType))
      ),
      resolve: async (node: Task, _args, ctx: CustomGraphQLContext) => {
        return ctx.introspector.getMiddlewaresByIds(node.middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this task with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node: Task, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewareUsagesForTask(node.id),
    },

    emitsResolved: {
      description: "Events emitted by this task (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: async (node: Task, _args, ctx: CustomGraphQLContext) => {
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
        "Flattened dependencies resolved to All (tasks, hooks, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node: Task, _args, ctx: CustomGraphQLContext) => {
        const { tasks, hooks, resources } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...hooks, ...resources];
      },
    },
    registeredBy: {
      description:
        "Id of the resource that registered this task (if any). Useful to trace provenance.",
      type: GraphQLString,
      resolve: (node: Task, _args, ctx: CustomGraphQLContext) => {
        // TODO: Store it in the mapping phase?
        if (node.registeredBy != null) return node.registeredBy;
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
      resolve: (node: Task, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy != null) {
          return ctx.introspector.getResource(node.registeredBy);
        }
        // Fallback for backward-compatibility
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r) => (r.registers || []).includes(node.id)) ||
          null
        );
      },
    },

    // Task-like explicit fields
    inputSchema: {
      description:
        "Prettified Zod JSON structure for the input schema, if provided",
      type: GraphQLString,
    },
    inputSchemaReadable: {
      description:
        "Readable text representation of the input schema, if provided",
      type: GraphQLString,
      resolve: (node: Task) => convertJsonSchemaToReadable(node.inputSchema),
    },

    dependsOnResolved: {
      description: "Resolved dependencies and emitted events for this task",
      type: new GraphQLNonNull(TaskDependsOnType),
      resolve: async (node: Task, _args, ctx: CustomGraphQLContext) => {
        const { tasks, hooks, resources, emitters } =
          await ctx.introspector.getDependencies(node);
        return { tasks, hooks, resources, emitters };
      },
    },

    runs: {
      description: "Execution run records for this task",
      args: {
        afterTimestamp: { type: GraphQLInt },
        last: { type: GraphQLInt },
        filter: { type: RunFilterInput },
      },
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(RunRecordType))
      ),
      resolve: (node: Task, args: any, ctx: CustomGraphQLContext) => {
        const opts = ctx.introspector.buildRunOptionsForTask(node.id, args);
        return ctx.live.getRuns(opts);
      },
    },

    // Durable workflow fields
    isDurable: {
      description:
        "Whether this task is a durable workflow (depends on a durable resource)",
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (node: Task, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.isDurableTask(node.id),
    },
    durableResource: {
      description: "The durable resource this task depends on (if any)",
      type: ResourceType,
      resolve: (node: Task, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getDurableResourceForTask(node.id),
    },
    flowShape: {
      description:
        "The workflow structure (steps, sleeps, signals, etc.) for durable tasks",
      type: DurableFlowShapeType,
      resolve: async (node: Task, _args, ctx: CustomGraphQLContext) =>
        describeDurableTaskFromStore(ctx.store, node.id, { timeoutMs: 800 }),
    },

    ...baseElementCommonFields(),
  }),
});

// HookType has been moved to HookType.ts
