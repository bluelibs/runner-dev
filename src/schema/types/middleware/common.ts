import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { MetaType } from "../MetaType";
import { EventType } from "../EventType";
import type { CustomGraphQLContext } from "../../context";
import { ResourceType } from "../ResourceType";
import { baseElementCommonFields } from "../BaseElementCommon";
import { sanitizePath } from "../../../utils/path";
import { convertJsonSchemaToReadable } from "../../../utils/zod";
import {
  MiddlewareResourceUsageType,
  MiddlewareTaskUsageType,
} from "./UsageTypes";
import { TaskType } from "../TaskType";

export const MiddlewareGlobalType = new (require("graphql").GraphQLObjectType)({
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

export function middlewareCommonFields(): GraphQLFieldConfigMap<any, any> {
  return {
    id: { description: "Middleware id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Middleware metadata", type: MetaType },
    filePath: {
      description: "Path to middleware file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    global: {
      description: "Global middleware configuration",
      type: MiddlewareGlobalType,
    },
    emits: {
      description: "Events emitted by task/hook nodes that use this middleware",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getMiddlewareEmittedEvents(node.id),
    },
    overriddenBy: {
      description: "Id of the resource that overrides this middleware (if any)",
      type: GraphQLString,
    },
    registeredBy: {
      description:
        "Id of the resource that registered this middleware (if any)",
      type: GraphQLString,
      resolve: (node: any, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy) return node.registeredBy;
        const allResources = ctx.introspector.getResources();
        const found = allResources.find((r: any) =>
          (r.registers || []).includes(node.id)
        );
        return found?.id ?? null;
      },
    },
    registeredByResolved: {
      description:
        "Resource that registered this middleware (resolved, if any)",
      type: ResourceType,
      resolve: (node: any, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy)
          return ctx.introspector.getResource(node.registeredBy);
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r: any) =>
            (r.registers || []).includes(node.id)
          ) || null
        );
      },
    },
    configSchema: {
      description:
        "Prettified Zod JSON structure for the middleware config schema, if provided",
      type: GraphQLString,
    },
    configSchemaReadable: {
      description:
        "Readable text representation of the middleware config schema, if provided",
      type: GraphQLString,
      resolve: (node: any) => convertJsonSchemaToReadable(node.configSchema),
    },
    ...baseElementCommonFields(),
  };
}

export function buildTaskMiddlewareFields(): GraphQLFieldConfigMap<any, any> {
  return {
    ...middlewareCommonFields(),
    usedBy: {
      description: "Task nodes that use this middleware (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      resolve: (node, _args, ctx) =>
        ctx.introspector
          .getTaskLikesUsingMiddleware(node.id)
          .filter((n: any) => !("event" in (n || {}))),
    },
    usedByDetailed: {
      description: "Detailed task/hook usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareTaskUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTasksUsingMiddlewareDetailed(String(node.id)),
    },
  };
}

export function buildResourceMiddlewareFields(): GraphQLFieldConfigMap<
  any,
  any
> {
  return {
    ...middlewareCommonFields(),
    usedBy: {
      description: "Resources that use this middleware (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getResourcesByIds(node.usedByResources),
    },
    usedByDetailed: {
      description: "Detailed resource usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareResourceUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResourcesUsingMiddlewareDetailed(String(node.id)),
    },
  };
}

export function buildLegacyCombinedMiddlewareFields(): GraphQLFieldConfigMap<
  any,
  any
> {
  return {
    ...middlewareCommonFields(),
    usedByTasks: {
      description: "Ids of task/hook nodes that use this middleware",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    usedByTasksResolved: {
      description: "Task/hook nodes that use this middleware (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      resolve: (node, _args, ctx) =>
        ctx.introspector
          .getTaskLikesUsingMiddleware(node.id)
          .filter((n: any) => !("event" in (n || {}))),
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
      description: "Detailed task/hook usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareTaskUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTasksUsingMiddlewareDetailed(String(node.id)),
    },
    usedByResourcesDetailed: {
      description: "Detailed resource usages with per-usage config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareResourceUsageType))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResourcesUsingMiddlewareDetailed(String(node.id)),
    },
  };
}
