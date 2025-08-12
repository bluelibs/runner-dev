import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { BaseElementInterface, MetaType } from "./AllType";
import { TaskInterface } from "./TaskType";

export const EventType: GraphQLObjectType = new GraphQLObjectType({
  name: "Event",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) => Array.isArray((value as any)?.listenedToBy),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { description: "Event id", type: new GraphQLNonNull(GraphQLID) },
    meta: { description: "Event metadata", type: MetaType },
    filePath: { description: "Path to event file", type: GraphQLString },
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
