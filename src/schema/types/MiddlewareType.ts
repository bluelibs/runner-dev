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
  // usedByTasks is always an array (possibly empty), so Boolean([]) matched
  // every middleware; the `type` discriminator is authoritative.
  isTypeOf: (value) => (value as any)?.type === "task",
  fields: (): GraphQLFieldConfigMap<any, any> => buildTaskMiddlewareFields(),
});

export const ResourceMiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "ResourceMiddleware",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) => (value as any)?.type === "resource",
  fields: (): GraphQLFieldConfigMap<any, any> =>
    buildResourceMiddlewareFields(),
});

// Backward-compatibility combined type
export const MiddlewareType: GraphQLObjectType = new GraphQLObjectType({
  name: "Middleware",
  interfaces: () => [BaseElementInterface],
  isTypeOf: (value) =>
    (value as any)?.type === "task" || (value as any)?.type === "resource",
  fields: (): GraphQLFieldConfigMap<any, any> =>
    buildLegacyCombinedMiddlewareFields(),
});
