import { globals, resource } from "@bluelibs/runner";
import { introspector } from "./introspector.resource";
import type { Introspector } from "./introspector.resource";
import {
  compileRunFunction,
  getTaskFromStore,
  getTaskDependencies,
  serializeResult,
  deserializeInput,
} from "./swap.tools";
import { randomUUID } from "crypto";

export interface SwapResult {
  success: boolean;
  error?: string;
  taskId: string;
}

export interface InvokeResult {
  success: boolean;
  error?: string;
  taskId: string;
  result?: string; // Serialized result
  executionTimeMs?: number;
  invocationId?: string; // For correlation
}

export interface EvalResult {
  success: boolean;
  error?: string;
  result?: string; // Serialized result
  executionTimeMs?: number;
  invocationId?: string; // For correlation
}

export interface SwappedTask {
  taskId: string;
  swappedAt: number;
  originalCode?: string;
}

export interface SwapManager {
  swap(taskId: string, runCode: string): Promise<SwapResult>;
  unswap(taskId: string): Promise<SwapResult>;
  unswapAll(): Promise<SwapResult[]>;
  getSwappedTasks(): SwappedTask[];
  isSwapped(taskId: string): boolean;
  invokeTask(
    taskId: string,
    inputJson?: string,
    pure?: boolean,
    evalInput?: boolean
  ): Promise<InvokeResult>;
  runnerEval(code: string): Promise<EvalResult>;
}

export const swapManager = resource({
  id: "runner-dev.resources.swap-manager",
  dependencies: {
    store: globals.resources.store,
    taskRunner: globals.resources.taskRunner,
    introspector,
    eventManager: globals.resources.eventManager,
  },
  async init(
    _,
    { store, introspector, taskRunner, eventManager }
  ): Promise<SwapManager> {
    // Track original run functions and swap metadata
    const originalRunFunctions = new Map<string, Function>();
    const swappedTasks = new Map<string, SwappedTask>();

    const api: SwapManager = {
      async swap(taskId: string, runCode: string): Promise<SwapResult> {
        try {
          // Validate task exists
          const task = getTaskFromStore(store, taskId);
          if (!task) {
            return {
              success: false,
              error: `Task '${taskId}' not found`,
              taskId,
            };
          }

          // Compile the new run function
          const compileResult = compileRunFunction(runCode);
          if (!compileResult.success) {
            return { success: false, error: compileResult.error, taskId };
          }

          // Store original run function if not already stored
          if (!originalRunFunctions.has(taskId)) {
            originalRunFunctions.set(taskId, task.run);
          }

          // Swap the run function
          task.run = compileResult.func as any;

          // Track the swap
          swappedTasks.set(taskId, {
            taskId,
            swappedAt: Date.now(),
            originalCode: originalRunFunctions.get(taskId)?.toString(),
          });

          return { success: true, taskId };
        } catch (error) {
          return {
            success: false,
            error: `Swap failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            taskId,
          };
        }
      },

      async unswap(taskId: string): Promise<SwapResult> {
        try {
          // Validate task exists and is swapped
          const task = getTaskFromStore(store, taskId);
          if (!task) {
            return {
              success: false,
              error: `Task '${taskId}' not found`,
              taskId,
            };
          }

          const originalRun = originalRunFunctions.get(taskId);
          if (!originalRun) {
            return {
              success: false,
              error: `Task '${taskId}' is not swapped`,
              taskId,
            };
          }

          // Restore original run function
          (task as any).run = originalRun;

          // Clean up tracking
          originalRunFunctions.delete(taskId);
          swappedTasks.delete(taskId);

          return { success: true, taskId };
        } catch (error) {
          return {
            success: false,
            error: `Unswap failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            taskId,
          };
        }
      },

      async unswapAll(): Promise<SwapResult[]> {
        const results: SwapResult[] = [];
        const swappedTaskIds = Array.from(swappedTasks.keys());

        for (const taskId of swappedTaskIds) {
          const result = await api.unswap(taskId);
          results.push(result);
        }

        return results;
      },

      getSwappedTasks(): SwappedTask[] {
        return Array.from(swappedTasks.values());
      },

      isSwapped(taskId: string): boolean {
        return swappedTasks.has(taskId);
      },

      async invokeTask(
        taskId: string,
        inputJson?: string,
        pure: boolean = false,
        evalInput: boolean = false
      ): Promise<InvokeResult> {
        const invocationId = randomUUID();
        const startTime = Date.now();

        try {
          // Validate task exists
          const task = getTaskFromStore(store, taskId);
          if (!task) {
            return {
              success: false,
              error: `Task '${taskId}' not found`,
              taskId,
              invocationId,
            };
          }

          // Process input - either JSON parse or JavaScript eval
          let input: any = undefined;
          if (inputJson) {
            try {
              if (evalInput) {
                // Evaluate as JavaScript expression
                input = eval(`(${inputJson})`);
              } else {
                // Parse as JSON
                input = deserializeInput(inputJson);
              }
            } catch (error) {
              const method = evalInput
                ? "JavaScript evaluation"
                : "JSON deserialization";
              return {
                success: false,
                error: `Input ${method} failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                taskId,
                invocationId,
              };
            }
          }

          // Execute exactly once based on mode
          let result: any;
          try {
            if (pure) {
              // Pure mode: Get computed dependencies from store (no middleware pipeline)
              const dependencies = getTaskDependencies(store, taskId);
              result = await task.run(input, dependencies);
            } else {
              // Standard mode: use taskRunner to execute through the pipeline
              result = await taskRunner.run(task, input);
            }
          } catch (taskError) {
            const executionTimeMs = Date.now() - startTime;
            return {
              success: false,
              error: `Task execution failed: ${
                taskError instanceof Error
                  ? taskError.message
                  : String(taskError)
              }`,
              taskId,
              executionTimeMs,
              invocationId,
            };
          }

          // Serialize result
          const serializedResult = serializeResult(result);
          const executionTimeMs = Date.now() - startTime;

          return {
            success: true,
            taskId,
            result: serializedResult,
            executionTimeMs,
            invocationId,
          };
        } catch (error) {
          const executionTimeMs = Date.now() - startTime;
          return {
            success: false,
            error: `Invocation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            taskId,
            executionTimeMs,
            invocationId,
          };
        }
      },

      async runnerEval(code: string): Promise<EvalResult> {
        const invocationId = randomUUID();
        const startTime = Date.now();
        try {
          // Compile provided code to an async function run(input, deps)
          const compileResult = compileRunFunction(code);
          if (!compileResult.success) {
            return { success: false, error: compileResult.error, invocationId };
          }

          // Provide a useful dependency bag for evaluation
          const dependencies = {
            store,
            introspector,
            globals,
            taskRunner,
            eventManager,
          };

          // Execute compiled function
          let result: unknown;
          try {
            result = await compileResult.func(dependencies);
          } catch (execError) {
            const executionTimeMs = Date.now() - startTime;
            return {
              success: false,
              error: `Evaluation execution failed: ${
                execError instanceof Error
                  ? execError.message
                  : String(execError)
              }`,
              executionTimeMs,
              invocationId,
            };
          }

          // Serialize result
          const serializedResult = serializeResult(result);
          const executionTimeMs = Date.now() - startTime;

          return {
            success: true,
            result: serializedResult,
            executionTimeMs,
            invocationId,
          };
        } catch (error) {
          const executionTimeMs = Date.now() - startTime;
          return {
            success: false,
            error: `Evaluation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            executionTimeMs,
            invocationId,
          };
        }
      },
    };

    return api;
  },
});
