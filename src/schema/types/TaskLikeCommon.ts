import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLFieldResolver,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import { TaskMiddlewareType } from "./MiddlewareType";
import { EventType } from "./EventType";
import { BaseElementInterface } from "./AllType";
import { convertJsonSchemaToReadable } from "../../utils/zod";

export function taskLikeCommonFields(params: {
  ResourceType: GraphQLObjectType;
  TaskMiddlewareUsageType: GraphQLObjectType;
  middlewareDetailedResolver?: GraphQLFieldResolver<any, CustomGraphQLContext>;
}): GraphQLFieldConfigMap<any, CustomGraphQLContext> {
  const { ResourceType, TaskMiddlewareUsageType, middlewareDetailedResolver } =
    params;

  return {
    inputSchema: {
      description:
        "Prettified Zod JSON structure for the input schema, if provided",
      type: GraphQLString,
    },
    inputSchemaReadable: {
      description:
        "Readable text representation of the input schema, if provided",
      type: GraphQLString,
      resolve: (node: any) => convertJsonSchemaToReadable(node.inputSchema),
    },
    emits: {
      description: "Event ids this task-like may emit (from dependencies)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    dependsOn: {
      description: "Ids of resources/tasks this task-like depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middleware: {
      description: "Ids of middlewares applied to this task-like",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    middlewareResolved: {
      description: "Middlewares applied to this task-like (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewaresByIds(node.middleware),
    },
    middlewareResolvedDetailed: {
      description:
        "Middlewares applied to this task-like with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareUsageType))
      ),
      resolve:
        middlewareDetailedResolver ||
        ((node, _args, ctx: CustomGraphQLContext) =>
          ctx.introspector.getMiddlewareUsagesForTask(node.id)),
    },
    emitsResolved: {
      description: "Events emitted by this task-like (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEventsByIds(node.emits),
    },
    overriddenBy: {
      description: "Id of the resource that overrides this task-like (if any)",
      type: GraphQLString,
    },
    registeredBy: {
      description: "Id of the resource that registered this task-like (if any)",
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
      description: "Resource that registered this task-like (resolved, if any)",
      type: ResourceType,
      resolve: (node, _args, ctx: CustomGraphQLContext) => {
        if ((node as any).registeredBy) {
          return ctx.introspector.getResource((node as any).registeredBy);
        }
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r) => (r.registers || []).includes(node.id)) ||
          null
        );
      },
    },
    dependsOnResolved: {
      description:
        "Flattened dependencies resolved to BaseElement (tasks, hooks, resources)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        const { tasks, hooks, resources } =
          await ctx.introspector.getDependencies(node);
        return [...tasks, ...hooks, ...resources];
      },
    },
  };
}
