import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLID,
  GraphQLList,
  GraphQLBoolean,
} from "graphql";
import {
  SwapResultType,
  InvokeResultType,
  EvalResultType,
} from "./types/SwapType";
import type { SwapManager } from "../resources/swap.resource";

export const createMutationType = (swapManager: SwapManager) => {
  return new GraphQLObjectType({
    name: "Mutation",
    description:
      "Mutations for hot-swapping, restoring and remotely invoking Runner tasks.",
    fields: () => ({
      swapTask: {
        description:
          "Hot-swaps the `run()` function of a task with new TypeScript or JavaScript code. The new code can be a full function definition, an arrow function, or just the function body.",
        type: new GraphQLNonNull(SwapResultType),
        args: {
          taskId: {
            description: "Id of the task to swap",
            type: new GraphQLNonNull(GraphQLID),
          },
          runCode: {
            description:
              "The TypeScript/JavaScript code for the new `run` function. Can be a full function `async function run(input, deps) { ... }`, an arrow function `() => { ... }`, or just the body of the function.",
            type: new GraphQLNonNull(GraphQLString),
          },
        },
        async resolve(_parent, { taskId, runCode }) {
          return await swapManager.swap(taskId, runCode);
        },
      },

      unswapTask: {
        description:
          "Restore the original implementation of a previously swapped task.",
        type: new GraphQLNonNull(SwapResultType),
        args: {
          taskId: {
            description: "Id of the task to restore",
            type: new GraphQLNonNull(GraphQLID),
          },
        },
        async resolve(_parent, { taskId }) {
          return await swapManager.unswap(taskId);
        },
      },

      unswapAllTasks: {
        description: "Restore all tasks to their original implementations.",
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(SwapResultType))
        ),
        args: {},
        async resolve() {
          return await swapManager.unswapAll();
        },
      },

      invokeTask: {
        description:
          "Invokes a task remotely with a given input. Supports bypassing middleware for 'pure' execution and evaluating input as JavaScript for dynamic testing.",
        type: new GraphQLNonNull(InvokeResultType),
        args: {
          taskId: {
            description: "Id of the task to invoke",
            type: new GraphQLNonNull(GraphQLID),
          },
          inputJson: {
            description:
              "The input for the task, as a string. By default, it's parsed as JSON. If `evalInput` is true, it's evaluated as a JavaScript expression.",
            type: GraphQLString,
          },
          pure: {
            description:
              "When true, executes the task directly with its dependencies, bypassing the middleware pipeline for a clean, isolated test run.",
            type: GraphQLBoolean,
            defaultValue: false,
          },
          evalInput: {
            description:
              "When true, `inputJson` is evaluated as a JavaScript expression, allowing for dynamic and complex inputs beyond simple JSON.",
            type: GraphQLBoolean,
            defaultValue: false,
          },
        },
        async resolve(_parent, { taskId, inputJson, pure, evalInput }) {
          return await swapManager.invokeTask(
            taskId,
            inputJson,
            pure,
            evalInput
          );
        },
      },

      eval: {
        description:
          "Executes arbitrary JavaScript/TypeScript code on the server. This is a powerful and potentially dangerous feature, intended for development and debugging purposes only. It is disabled by default in production environments.",
        type: new GraphQLNonNull(EvalResultType),
        args: {
          code: {
            description: "The JavaScript/TypeScript code to execute.",
            type: new GraphQLNonNull(GraphQLString),
          },
          inputJson: {
            description:
              "An optional input string, treated as JSON by default. Can be made available to the executed code.",
            type: GraphQLString,
          },
          evalInput: {
            description:
              "When true, `inputJson` is evaluated as a JavaScript expression instead of being parsed as JSON.",
            type: GraphQLBoolean,
            defaultValue: false,
          },
        },
        async resolve(_parent, { code, inputJson, evalInput }, _ctx) {
          // Basic safeguard: allow only in non-production by default
          const allowEval =
            process.env.RUNNER_DEV_EVAL === "1" ||
            process.env.NODE_ENV !== "production";
          if (!allowEval) {
            return {
              success: false,
              error: "Eval is disabled in this environment",
            };
          }
          return await swapManager.eval(code, inputJson, evalInput);
        },
      },
    }),
  });
};
