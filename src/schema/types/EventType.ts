import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { BaseElementInterface } from "./AllType";
import { MetaType } from "./MetaType";
import { TaskInterface } from "./TaskType";
import { CustomGraphQLContext } from "../../graphql/context";

export const EventType: GraphQLObjectType = new GraphQLObjectType({
  name: "Event",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) => Array.isArray((value as any)?.listenedToBy),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Event id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Event metadata", type: MetaType },
    filePath: { description: "Path to event file", type: GraphQLString },
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
  }),
});
