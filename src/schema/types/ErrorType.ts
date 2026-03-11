import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

import type { CustomGraphQLContext } from "../context";
import type { Error as ErrorModel } from "../model";
import { BaseElementInterface } from "./AllType";
import { baseElementCommonFields } from "./BaseElementCommon";

export const ErrorType = new GraphQLObjectType<
  ErrorModel,
  CustomGraphQLContext
>({
  name: "Error",
  description:
    "A defined application error that can be thrown by tasks or resources",
  interfaces: () => [BaseElementInterface],
  fields: () => ({
    ...baseElementCommonFields(),
    dataSchema: {
      description: "Prettified schema for the error data structure",
      type: GraphQLString,
    },
    thrownBy: {
      description: "Tasks and resources that throw this error",
      type: new GraphQLNonNull(
        new GraphQLList(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          new GraphQLNonNull(require("./AllType").AllType)
        )
      ),
      resolve: (error, _args, ctx: CustomGraphQLContext) => {
        const results: any[] = [];

        // Get tasks that throw this error
        for (const taskId of error.thrownBy || []) {
          const task = ctx.introspector.getTask(taskId);
          if (task) results.push(task);
        }

        // Get resources that throw this error
        for (const resourceId of error.thrownBy || []) {
          const resource = ctx.introspector.getResource(resourceId);
          if (resource) results.push(resource);
        }

        return results;
      },
    },
  }),
});
