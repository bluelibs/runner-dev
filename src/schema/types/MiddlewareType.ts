import {
  buildLegacyCombinedMiddlewareFields,
  buildResourceMiddlewareFields,
  buildTaskMiddlewareFields,
} from "./middleware/common";
import { GraphQLObjectType, type GraphQLFieldConfigMap } from "graphql";
import { BaseElementInterface } from "./AllType";

export const TaskMiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "TaskMiddleware",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) => Boolean((value as any)?.usedByTasks),
  fields: (): GraphQLFieldConfigMap<any, any> => buildTaskMiddlewareFields(),
});

export const ResourceMiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "ResourceMiddleware",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) => Boolean((value as any)?.usedByResources),
  fields: (): GraphQLFieldConfigMap<any, any> =>
    buildResourceMiddlewareFields(),
});

// Backward-compatibility combined type
export const MiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "Middleware",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) =>
    Boolean((value as any)?.usedByTasks && (value as any)?.usedByResources),
  fields: (): GraphQLFieldConfigMap<any, any> =>
    buildLegacyCombinedMiddlewareFields(),
});
