import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import type { AsyncContext as AsyncContextModel } from "../model";
import { BaseElementInterface } from "./AllType";
import { ResourceType } from "./ResourceType";
import { baseElementCommonFields } from "./BaseElementCommon";

export const AsyncContextType = new GraphQLObjectType<
  AsyncContextModel,
  CustomGraphQLContext
>({
  name: "AsyncContext",
  description:
    "An async context definition for async call-chain data propagation",
  interfaces: [BaseElementInterface],
  fields: () => ({
    ...baseElementCommonFields(),
    serialize: {
      description: "Serialization method signature",
      type: GraphQLString,
    },
    parse: {
      description: "Parse method signature",
      type: GraphQLString,
    },
    usedBy: {
      description:
        "Tasks, hooks, resources, and middlewares that use this async context as a dependency",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: (context, _args, ctx: CustomGraphQLContext) => {
        const results: any[] = [];

        for (const elementId of context.usedBy || []) {
          const task = ctx.introspector.getTask(elementId);
          if (task) {
            results.push(task);
            continue;
          }

          const hook = ctx.introspector.getHook(elementId);
          if (hook) {
            results.push(hook);
            continue;
          }

          const resource = ctx.introspector.getResource(elementId);
          if (resource) {
            results.push(resource);
            continue;
          }

          const middleware = ctx.introspector.getMiddleware(elementId);
          if (middleware) results.push(middleware);
        }

        return results;
      },
    },
    requiredBy: {
      description:
        "Tasks that use .require() middleware for this async context",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: (context, _args, ctx: CustomGraphQLContext) => {
        const results: any[] = [];

        for (const elementId of context.requiredBy || []) {
          const task = ctx.introspector.getTask(elementId);
          if (task) {
            results.push(task);
            continue;
          }
          const resource = ctx.introspector.getResource(elementId);
          if (resource) results.push(resource);
        }

        return results;
      },
    },
    providedBy: {
      description: "Resources that provide this async context",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: (context, _args, ctx: CustomGraphQLContext) => {
        const results: any[] = [];

        for (const resourceId of context.providedBy || []) {
          const resource = ctx.introspector.getResource(resourceId);
          if (resource) results.push(resource);
        }

        return results;
      },
    },
  }),
});
