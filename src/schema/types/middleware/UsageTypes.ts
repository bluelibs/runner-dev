import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLFieldConfigMap,
} from "graphql";

import { ResourceType } from "../ResourceType";
import { TaskType } from "../TaskType";

export const MiddlewareTaskUsageType: GraphQLObjectType = new GraphQLObjectType(
  {
    name: "MiddlewareTaskUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLID },
      node: { type: new GraphQLNonNull(TaskType) },
    }),
  }
);

export const MiddlewareResourceUsageType: GraphQLObjectType =
  new GraphQLObjectType({
    name: "MiddlewareResourceUsage",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      config: { type: GraphQLID },
      node: { type: new GraphQLNonNull(ResourceType) },
    }),
  });
