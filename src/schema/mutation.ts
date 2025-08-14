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
import { CustomGraphQLContext } from "./context";

export const MutationType = new GraphQLObjectType({
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
      async resolve(_parent, { taskId, runCode }, ctx: CustomGraphQLContext) {
        return await ctx.swapManager.swap(taskId, runCode);
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
      async resolve(_parent, { taskId }, ctx: CustomGraphQLContext) {
        return await ctx.swapManager.unswap(taskId);
      },
    },

    unswapAllTasks: {
      description: "Restore all tasks to their original implementations.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(SwapResultType))
      ),
      args: {},
      async resolve(_parent, _args, ctx: CustomGraphQLContext) {
        return await ctx.swapManager.unswapAll();
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
      async resolve(
        _parent,
        { taskId, inputJson, pure, evalInput },
        ctx: CustomGraphQLContext
      ) {
        return await ctx.swapManager.invokeTask(
          taskId,
          inputJson,
          pure,
          evalInput
        );
      },
    },
    eval: {
      description: [
        "Eval context (via the eval mutation):",
        "- User code executes as: async function run(deps)",
        "- deps: provides a minimal, safe context:",
        "  - store: Runner store (read-only access patterns recommended)",
        "  - eventManager: Runner event manager (read-only access patterns recommended)",
        "  - taskRunner: Runner task runner (read-only access patterns recommended)",
        "  - introspector: Introspector API for tasks/listeners/resources/middleware/events",
        "",
        "Security: eval is disabled by default in production; enable with RUNNER_DEV_EVAL=1.",
      ].join("\n"),
      type: new GraphQLNonNull(EvalResultType),
      args: {
        code: {
          description:
            "The JavaScript/TypeScript code to execute. Given access to dependencies. async function run(deps) { ... }",
          type: new GraphQLNonNull(GraphQLString),
        },
      },
      async resolve(_parent, { code }, ctx: CustomGraphQLContext) {
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
        return await ctx.swapManager.runnerEval(code);
      },
    },
  }),
});
