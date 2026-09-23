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
  InvokeEventResultType,
  ShellResultType,
} from "./types/SwapType";
import { CustomGraphQLContext } from "./context";
import {
  codeExecutionDisabledMessage,
  isCodeExecutionAllowed,
} from "./codeExecutionGate";
import { resolvePathInput } from "../utils/path";
import { promises as fs } from "fs";

const EVAL_INPUT_FEATURE = "Evaluating input as JavaScript (evalInput)";

export const MutationType = new GraphQLObjectType({
  name: "Mutation",
  description:
    "Mutations for hot-swapping, restoring and remotely invoking Runner tasks.",
  fields: () => ({
    swapTask: {
      description:
        "Hot-swaps the `run()` function of a task with new TypeScript or JavaScript code. The new code can be a full function definition, an arrow function, or just the function body. Security: compiles and runs server-side code, so it is gated like `eval` (RUNNER_DEV_EVAL=1 or NODE_ENV=development/test).",
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
        if (!isCodeExecutionAllowed()) {
          return {
            success: false,
            error: codeExecutionDisabledMessage("Task swapping"),
            taskId,
          };
        }
        return await ctx.swapManager.swap(taskId, runCode);
      },
    },
    editFile: {
      description:
        "Edits (overwrites) a file on disk. Accepts a structured path (eg. 'workspace:src/index.ts') and UTF-8 content. Returns success/error.",
      type: new GraphQLNonNull(
        new GraphQLObjectType({
          name: "EditFileResult",
          fields: () => ({
            success: { type: new GraphQLNonNull(GraphQLBoolean) },
            error: { type: GraphQLString },
            path: { type: new GraphQLNonNull(GraphQLString) },
            resolvedPath: { type: GraphQLString },
          }),
        })
      ),
      args: {
        path: {
          description:
            "Structured file path (eg. 'workspace:src/file.ts'). Absolute paths are also accepted.",
          type: new GraphQLNonNull(GraphQLString),
        },
        content: {
          description: "New UTF-8 content to write to the file.",
          type: new GraphQLNonNull(GraphQLString),
        },
      },
      async resolve(
        _parent,
        { path, content }: { path: string; content: string }
      ) {
        try {
          const resolved = resolvePathInput(path);
          if (!resolved) {
            return {
              success: false,
              error: "Unable to resolve path",
              path,
              resolvedPath: null,
            };
          }
          await fs.writeFile(resolved, content, { encoding: "utf8" });
          return { success: true, path, resolvedPath: resolved };
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          return { success: false, error: err, path, resolvedPath: null };
        }
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

    invokeEvent: {
      description: "Invokes an event remotely with a given input.",
      type: new GraphQLNonNull(InvokeEventResultType),
      args: {
        eventId: {
          description: "Id of the event to invoke",
          type: new GraphQLNonNull(GraphQLID),
        },
        inputJson: {
          description: "The input for the event, as a string.",
          type: GraphQLString,
        },
        evalInput: {
          description:
            "When true, `inputJson` is evaluated as a JavaScript expression, allowing for dynamic and complex inputs beyond simple JSON. Gated like `eval` (RUNNER_DEV_EVAL=1 or NODE_ENV=development/test); plain JSON input is always allowed.",
          type: GraphQLBoolean,
          defaultValue: false,
        },
      },
      async resolve(
        _parent,
        { eventId, inputJson, evalInput },
        ctx: CustomGraphQLContext
      ) {
        if (evalInput && !isCodeExecutionAllowed()) {
          return {
            success: false,
            error: codeExecutionDisabledMessage(EVAL_INPUT_FEATURE),
          };
        }
        return await ctx.swapManager.invokeEvent(eventId, inputJson, evalInput);
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
            "When true, `inputJson` is evaluated as a JavaScript expression, allowing for dynamic and complex inputs beyond simple JSON. Gated like `eval` (RUNNER_DEV_EVAL=1 or NODE_ENV=development/test); plain JSON input is always allowed.",
          type: GraphQLBoolean,
          defaultValue: false,
        },
      },
      async resolve(
        _parent,
        { taskId, inputJson, pure, evalInput },
        ctx: CustomGraphQLContext
      ) {
        if (evalInput && !isCodeExecutionAllowed()) {
          return {
            success: false,
            error: codeExecutionDisabledMessage(EVAL_INPUT_FEATURE),
            taskId,
          };
        }
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
        "  - introspector: Introspector API for tasks/hooks/resources/middleware/events",
        "",
        "Security: eval runs only with RUNNER_DEV_EVAL=1 or NODE_ENV=development/test (disabled when NODE_ENV is unset).",
      ].join("\n"),
      type: new GraphQLNonNull(EvalResultType),
      args: {
        code: {
          description: [
            "The JavaScript/TypeScript code to execute. Given access to dependencies",
            "You should pass the complete signature (including async): async function run(deps) { CODE }",
          ].join("\n"),
          type: new GraphQLNonNull(GraphQLString),
        },
      },
      async resolve(_parent, { code }, ctx: CustomGraphQLContext) {
        if (!isCodeExecutionAllowed()) {
          return {
            success: false,
            error: codeExecutionDisabledMessage("Eval"),
          };
        }
        return await ctx.swapManager.runnerEval(code);
      },
    },
    shell: {
      description: [
        "Runs a JavaScript/TypeScript snippet against the live runtime (REPL shell).",
        'Bare expressions auto-return (`r`, `await runtime.runTask("...")`);',
        "multi-statement snippets use `return` for the result.",
        "- r: initialized value of `resourceId` (null without one)",
        "- runtime: live IRuntime (runTask, emitEvent, getResourceValue, getResourceConfig, getHealth, ...)",
        "- console: captured; lines are returned in `logs`",
        "",
        "Security: shell runs only with RUNNER_DEV_EVAL=1 or NODE_ENV=development/test (disabled when NODE_ENV is unset).",
        "Runs are capped by RUNNER_DEV_SHELL_TIMEOUT_MS (default 30000) and results are truncated past 256 KB.",
      ].join("\n"),
      type: new GraphQLNonNull(ShellResultType),
      args: {
        code: {
          description:
            "The JavaScript/TypeScript snippet to execute with `r` and `runtime` in scope.",
          type: new GraphQLNonNull(GraphQLString),
        },
        resourceId: {
          description:
            "Optional resource id to bind as `r` (exact or suffix match).",
          type: GraphQLID,
        },
      },
      async resolve(
        _parent,
        { code, resourceId }: { code: string; resourceId?: string | null },
        ctx: CustomGraphQLContext
      ) {
        if (!isCodeExecutionAllowed()) {
          return {
            success: false,
            error: codeExecutionDisabledMessage("Shell"),
          };
        }
        return await ctx.swapManager.shell(code, resourceId ?? null);
      },
    },
  }),
});
