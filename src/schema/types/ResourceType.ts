import {
  GraphQLEnumType,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { ResourceMiddlewareType } from "./MiddlewareType";
import { TaskType } from "./TaskType";
import { EventType } from "./EventType";
import { CustomGraphQLContext } from "../context";
import { TaskMiddlewareUsageType } from "./TaskType";
import { Resource } from "../model";
import { baseElementCommonFields } from "./BaseElementCommon";
import { sanitizePath } from "../../utils/path";
import { convertJsonSchemaToReadable } from "../../utils/zod";
import { CoverageInfoType } from "./CoverageType";
import { hasTunnelTag } from "../../resources/models/tunnel.tools";

const IsolationExportsModeType = new GraphQLEnumType({
  name: "IsolationExportsMode",
  values: {
    UNSET: { value: "unset" },
    NONE: { value: "none" },
    LIST: { value: "list" },
  },
});

const ResourceIsolationType = new GraphQLObjectType({
  name: "ResourceIsolation",
  fields: {
    deny: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    only: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    exports: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    exportsMode: {
      type: new GraphQLNonNull(IsolationExportsModeType),
    },
  },
});

export const ResourceType: GraphQLObjectType = new GraphQLObjectType({
  name: "Resource",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) =>
    Array.isArray((value as any)?.registers) &&
    Array.isArray((value as any)?.overrides),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Resource id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Resource metadata", type: MetaType },
    filePath: {
      description: "Path to resource file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    dependsOn: {
      description: "Ids of resources this resource depends on",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    dependsOnResolved: {
      description: "Resources this resource depends on (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: async (node: Resource, _args, ctx: CustomGraphQLContext) => {
        return ctx.introspector.getResourcesByIds(node.dependsOn);
      },
    },
    config: {
      description: "Serialized resource config (if any)",
      type: GraphQLString,
    },
    configSchema: {
      description:
        "Prettified Zod JSON structure for the resource config schema, if provided",
      type: GraphQLString,
    },
    configSchemaReadable: {
      description:
        "Readable text representation of the resource config schema, if provided",
      type: GraphQLString,
      resolve: (node: Resource) =>
        convertJsonSchemaToReadable(node.configSchema),
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
        new GraphQLList(new GraphQLNonNull(ResourceMiddlewareType))
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
        // We only have ids; return what we can resolve (tasks/hooks/resources/middleware)
        const ids: string[] = node.overrides;
        const tasks = ctx.introspector.getTasksByIds(ids);
        const hooks = ctx.introspector.getHooksByIds(ids);
        const resources = ctx.introspector.getResourcesByIds(ids);
        const middlewares = ctx.introspector.getMiddlewaresByIds(ids);
        return [...tasks, ...hooks, ...resources, ...middlewares];
      },
    },
    registers: {
      description: "Ids of items this resource registers",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    isolation: {
      description:
        "Resource isolation policy generated from .isolate({ deny/only/exports }).",
      type: ResourceIsolationType,
      resolve: (node: Resource) => node.isolation ?? null,
    },
    registersResolved: {
      description: "The items registered by this resource (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        const ids: string[] = node.registers;
        const tasks = ctx.introspector.getTasksByIds(ids);
        const hooks = ctx.introspector.getHooksByIds(ids);
        const resources = ctx.introspector.getResourcesByIds(ids);
        const middlewares = ctx.introspector.getMiddlewaresByIds(ids);
        const events = ctx.introspector.getEventsByIds(ids);
        return [...tasks, ...hooks, ...resources, ...middlewares, ...events];
      },
    },
    usedBy: {
      description: "Task nodes using this resource (resolved)",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      resolve: async (node, _args, ctx: CustomGraphQLContext) => {
        return ctx.introspector
          .getTasksUsingResource(node.id)
          .filter((n: any) => !("event" in (n || {})));
      },
    },
    emits: {
      description: "Events emitted by tasks/hooks that depend on this resource",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEmittedEventsForResource(node.id),
    },
    context: {
      description: "Serialized context (if any)",
      type: GraphQLString,
    },
    tunnelInfo: {
      description:
        "Tunnel configuration (present when resource has tunnel tag)",
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      type: require("./TunnelInfoType").TunnelInfoType,
      resolve: (resource, _args, ctx: CustomGraphQLContext) => {
        if (!hasTunnelTag(resource.tags || null)) return null;

        // Refresh from live store-backed values when available.
        ctx.introspector.populateTunnelInfo();
        return (
          ctx.introspector.getResource(resource.id)?.tunnelInfo ||
          resource.tunnelInfo ||
          null
        );
      },
    },
    coverage: {
      description:
        "Coverage summary for this resource's file (percentage is always resolvable if coverage report is present).",
      type: CoverageInfoType,
      resolve: (node: Resource) => ({ filePath: node.filePath || null }),
    },
    registeredBy: {
      description: "Id of the resource that registered this resource (if any)",
      type: GraphQLString,
      resolve: (node: Resource, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy) return node.registeredBy;
        const allResources = ctx.introspector.getResources();
        const found = allResources.find((r) =>
          (r.registers || []).includes(node.id)
        );
        return found?.id ?? null;
      },
    },
    registeredByResolved: {
      description: "Resource that registered this resource (resolved, if any)",
      type: ResourceType,
      resolve: (node: Resource, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy) {
          return ctx.introspector.getResource(node.registeredBy);
        }
        const allResources = ctx.introspector.getResources();
        return (
          allResources.find((r) => (r.registers || []).includes(node.id)) ||
          null
        );
      },
    },
    ...baseElementCommonFields(),
  }),
});
