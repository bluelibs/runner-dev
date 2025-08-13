import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import { GraphQLBoolean, GraphQLInputObjectType } from "graphql";

import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { TaskInterface } from "./TaskType";
import { CustomGraphQLContext } from "../../graphql/context";
import { ResourceType } from "./ResourceType";
import { baseElementCommonFields } from "./BaseElementCommon";
import { sanitizePath } from "../../utils/path";

export const EventType: GraphQLObjectType = new GraphQLObjectType({
  name: "Event",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) => Array.isArray((value as any)?.listenedToBy),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Event id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Event metadata", type: MetaType },
    filePath: {
      description: "Path to event file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    emittedBy: {
      description: "Ids of task/listener nodes that emit this event",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEmittersOfEvent(node.id).map((t: any) => t.id),
    },
    emittedByResolved: {
      description: "Task/listener nodes that emit this event (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskInterface))
      ),
      resolve: (node, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEmittersOfEvent(node.id),
    },
    listenedToBy: {
      description: "Ids of task/listener nodes listening to this event",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
    },
    listenedToByResolved: {
      description: "Task/listener nodes listening to this event (resolved)",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskInterface))
      ),
      resolve: (node, _args, ctx) =>
        ctx.introspector.getListenersOfEvent(node.id),
    },
    registeredBy: {
      description: "Id of the resource that registered this event (if any)",
      type: GraphQLString,
      resolve: (node: any, _args, ctx: CustomGraphQLContext) => {
        if (node.registeredBy) return node.registeredBy;
        const allResources = ctx.introspector.getResources();
        const found = allResources.find((r) =>
          (r.registers || []).includes(node.id)
        );
        return found?.id ?? null;
      },
    },
    registeredByResolved: {
      description: "Resource that registered this event (resolved, if any)",
      type: ResourceType,
      resolve: (node: any, _args, ctx: CustomGraphQLContext) => {
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

export const EventFilterInput = new GraphQLInputObjectType({
  name: "EventFilterInput",
  description: "Filters for events in the system",
  fields: {
    hasNoListeners: {
      description: "When true, only events without listeners are returned.",
      type: GraphQLBoolean,
    },
    hideSystem: {
      description:
        "When true, hides internal/system events (runner-dev/globals).",
      type: GraphQLBoolean,
    },
    idStartsWith: {
      description: "Return only events whose id starts with this prefix.",
      type: GraphQLString,
    },
  },
});
