import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

import { ResourceType } from "../ResourceType";
import { TaskType } from "../TaskType";

export const MiddlewareTaskUsageType: GraphQLObjectType = new GraphQLObjectType(
  {
    name: "MiddlewareTaskUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLString },
      origin: { type: GraphQLString },
      subtreeOwnerId: { type: GraphQLID },
      node: { type: new GraphQLNonNull(TaskType) },
    }),
  }
);

export const MiddlewareResourceUsageType: GraphQLObjectType =
  new GraphQLObjectType({
    name: "MiddlewareResourceUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLString },
      node: { type: new GraphQLNonNull(ResourceType) },
    }),
  });
