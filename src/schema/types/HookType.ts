import {
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import type { Hook } from "../model";
import type { CustomGraphQLContext } from "../context";
import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { ResourceType } from "./ResourceType";
import { EventType } from "./EventType";
import { baseElementCommonFields } from "./BaseElementCommon";
import { TaskMiddlewareType } from "./MiddlewareType";
import { TaskMiddlewareUsageType } from "./TaskType";
import { sanitizePath } from "../../utils/path";

export const HookType = new GraphQLObjectType({
  name: "Hook",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) => typeof (value as any)?.event === "string",
  fields: () => ({
    id: { description: "Hook id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Hook metadata", type: MetaType },
    filePath: {
      description: "Path to hook file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    emits: {
      description: "Event ids this hook may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    dependsOn: {
      description: "Ids of resources/tasks this hook depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middleware: {
      description: "Ids of middlewares applied to this hook",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this hook (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareType))
      ),
      resolve: async (node: Hook, _args, ctx: CustomGraphQLContext) => {
        return ctx.introspector.getMiddlewaresByIds((node as any).middleware);
      },
    },
    middlewareResolvedDetailed: {
      description: "Middlewares applied to this hook with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve: (node: Hook, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewareUsagesForTask((node as any).id),
    },
    emitsResolved: {
      description: "Events emitted by this hook (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEventsByIds(node.emits),
    },
    event: {
      description: "The event id this hook listens to",
      type: new GraphQLNonNull(GraphQLString),
    },
    hookOrder: {
      description: "Execution order among hooks for the same event",
      type: GraphQLInt,
    },
    depenendsOnResolved: {
      description:
        "Flattened dependencies resolved to All (tasks, hooks, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node: Hook, _args, ctx: CustomGraphQLContext) => {
        const { tasks, resources, emitters } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...resources, ...emitters];
      },
    },
    overriddenBy: {
      description:
        "Id of the resource that overrides this hook (if any). Overriding replaces registrations at runtime.",
      type: GraphQLString,
    },
    registeredBy: {
      description:
        "Id of the resource that registered this hook (if any). Useful to trace provenance.",
      type: GraphQLString,
      resolve: (node: Hook, _args, ctx: CustomGraphQLContext) => {
        if ((node as any).registeredBy != null)
          return (node as any).registeredBy;
        const allResources = ctx.introspector.getResources();
        const found = allResources.find((r) =>
          (r.registers || []).includes((node as any).id)
        );
        return found?.id ?? null;
      },
    },
    registeredByResolved: {
      description: "Resource that registered this hook (resolved, if any)",
      type: ResourceType,
      resolve: (node: Hook, _args, ctx: CustomGraphQLContext) => {
        if ((node as any).registeredBy != null) {
          return ctx.introspector.getResource((node as any).registeredBy);
        }
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r) =>
            (r.registers || []).includes((node as any).id)
          ) || null
        );
      },
    },
    ...baseElementCommonFields(),
  }),
});
