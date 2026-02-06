import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import type { AsyncContext as AsyncContextModel } from "../model";
import { BaseElementInterface } from "./AllType";
import { TaskType } from "./TaskType";
import { ResourceType } from "./ResourceType";
import { baseElementCommonFields } from "./BaseElementCommon";

export const AsyncContextType = new GraphQLObjectType<
  AsyncContextModel,
  CustomGraphQLContext
>({
  name: "AsyncContext",
  description: "An async context definition for request-scoped data propagation",
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
      description: "Tasks and resources that use this async context",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(require("./AllType").AllType))
      ),
      resolve: (context, _args, ctx: CustomGraphQLContext) => {
        const results: any[] = [];

        // Get tasks that use this context
        for (const taskId of context.usedBy || []) {
          const task = ctx.introspector.getTask(taskId);
          if (task) results.push(task);
        }

        // Get resources that use this context
        for (const resourceId of context.usedBy || []) {
          const resource = ctx.introspector.getResource(resourceId);
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