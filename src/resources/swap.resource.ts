import { resources, defineResource } from "@bluelibs/runner";
import { introspector } from "./introspector.resource";
import {
  compileRunFunction,
  getTaskStoreElement,
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

export interface InvokeEventResult {
  success: boolean;
  error?: string;
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

export interface ISwapManager {
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
  invokeEvent(
    eventId: string,
    inputJson?: string,
    evalInput?: boolean
  ): Promise<InvokeEventResult>;
  runnerEval(code: string): Promise<EvalResult>;
}

export const swapManager = defineResource({
  id: "swap-manager",
  meta: {
    title: "Task Swap Manager",
    description:
      "Enables runtime swapping of task implementations and provides task/event invocation capabilities for development",
  },
  dependencies: {
    store: resources.store,
    taskRunner: resources.taskRunner,
    introspector,
    eventManager: resources.eventManager,
  },
  async init(
    _,
    { store, introspector, taskRunner, eventManager }
  ): Promise<ISwapManager> {
    // Track swap metadata and swap interceptor wiring (deep-freeze safe).
    const originalRunCodeByTaskId = new Map<string, string | undefined>();
    const swappedTasks = new Map<string, SwappedTask>();
    const swappedRunFunctions = new Map<string, (...args: any[]) => any>();
    const installedInterceptors = new Map<
      string,
      (
        next: (input: unknown) => Promise<unknown>,
        input: unknown
      ) => Promise<unknown>
    >();

    const ensureSwapInterceptor = (taskId: string): string | null => {
      if (installedInterceptors.has(taskId)) {
        return null;
      }

      const storeTaskElement = getTaskStoreElement(store, taskId) as {
        interceptors?: Array<{ interceptor: any; ownerResourceId?: string }>;
      } | null;
      if (!storeTaskElement) {
        return `Task '${taskId}' not found`;
      }

      const interceptor = async (
        next: (input: unknown) => Promise<unknown>,
        input: unknown
      ): Promise<unknown> => {
        const swappedRun = swappedRunFunctions.get(taskId);
        if (!swappedRun) {
          return next(input);
        }

        const dependencies = getTaskDependencies(store, taskId);
        return swappedRun(input, dependencies);
      };

      if (!Array.isArray(storeTaskElement.interceptors)) {
        storeTaskElement.interceptors = [];
      }
      storeTaskElement.interceptors.push({
        interceptor,
        ownerResourceId: swapManager.id,
      });
      installedInterceptors.set(taskId, interceptor);

      return null;
    };

    const removeSwapInterceptor = (taskId: string): void => {
      const interceptor = installedInterceptors.get(taskId);
      if (!interceptor) return;

      const storeTaskElement = getTaskStoreElement(store, taskId) as {
        interceptors?: Array<{ interceptor: any; ownerResourceId?: string }>;
      } | null;
      if (storeTaskElement && Array.isArray(storeTaskElement.interceptors)) {
        storeTaskElement.interceptors = storeTaskElement.interceptors.filter(
          (record) => record.interceptor !== interceptor
        );
      }

      installedInterceptors.delete(taskId);
    };

    const invalidateTaskRunnerCache = (taskId: string): void => {
      const runnerStore = (taskRunner as any)?.runnerStore;
      if (runnerStore && typeof runnerStore.delete === "function") {
        runnerStore.delete(taskId);
      }
    };

    const idsMatch = (candidateId: string, referenceId: string): boolean => {
      return (
        candidateId === referenceId || candidateId.endsWith(`.${referenceId}`)
      );
    };

    const resolveReference = <T>(
      inputId: string,
      elements: Iterable<T>,
      getId: (element: T) => string | null | undefined
    ) => {
      let exactMatch: { element: T; id: string } | null = null;
      const suffixMatches: Array<{ element: T; id: string }> = [];

      for (const element of elements) {
        const candidateId = getId(element);
        if (!candidateId) continue;

        if (candidateId === inputId) {
          exactMatch = { element, id: candidateId };
          break;
        }

        if (idsMatch(candidateId, inputId)) {
          suffixMatches.push({ element, id: candidateId });
        }
      }

      if (exactMatch) {
        return {
          element: exactMatch.element,
          resolvedId: exactMatch.id,
          ambiguousIds: [] as string[],
        };
      }

      if (suffixMatches.length === 1) {
        return {
          element: suffixMatches[0].element,
          resolvedId: suffixMatches[0].id,
          ambiguousIds: [] as string[],
        };
      }

      return {
        element: null,
        resolvedId: inputId,
        ambiguousIds: suffixMatches.map((match) => match.id),
      };
    };

    const resolveTaskReference = (inputTaskId: string) => {
      const match = resolveReference(
        inputTaskId,
        store.tasks.values(),
        (entry: any) => (entry?.task ? String(entry.task.id) : null)
      );

      return {
        task: match.element?.task ?? null,
        taskId: match.resolvedId,
        ambiguousTaskIds: match.ambiguousIds,
      };
    };

    const resolveEventReference = (inputEventId: string) => {
      const match = resolveReference(
        inputEventId,
        store.events.values(),
        (entry: any) => (entry?.event ? String(entry.event.id) : null)
      );

      return {
        event: match.element?.event ?? null,
        eventId: match.resolvedId,
        ambiguousEventIds: match.ambiguousIds,
      };
    };

    const api: ISwapManager = {
      async swap(taskId: string, runCode: string): Promise<SwapResult> {
        try {
          const {
            task,
            taskId: resolvedTaskId,
            ambiguousTaskIds,
          } = resolveTaskReference(taskId);

          if (ambiguousTaskIds.length > 1) {
            return {
              success: false,
              error: `Task '${taskId}' is ambiguous. Use one of: ${ambiguousTaskIds.join(
                ", "
              )}`,
              taskId,
            };
          }

          // Validate task exists
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

          // Capture original code for diagnostics/history.
          if (!originalRunCodeByTaskId.has(resolvedTaskId)) {
            originalRunCodeByTaskId.set(
              resolvedTaskId,
              typeof task.run === "function" ? task.run.toString() : undefined
            );
          }

          const installError = ensureSwapInterceptor(resolvedTaskId);
          if (installError) {
            return {
              success: false,
              error: installError,
              taskId: resolvedTaskId,
            };
          }

          // Register swapped function; interceptor dispatches to this map.
          swappedRunFunctions.set(resolvedTaskId, compileResult.func as any);
          invalidateTaskRunnerCache(resolvedTaskId);

          // Track the swap
          swappedTasks.set(resolvedTaskId, {
            taskId: resolvedTaskId,
            swappedAt: Date.now(),
            originalCode: originalRunCodeByTaskId.get(resolvedTaskId),
          });

          return { success: true, taskId: resolvedTaskId };
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
          const {
            task,
            taskId: resolvedTaskId,
            ambiguousTaskIds,
          } = resolveTaskReference(taskId);

          if (ambiguousTaskIds.length > 1) {
            return {
              success: false,
              error: `Task '${taskId}' is ambiguous. Use one of: ${ambiguousTaskIds.join(
                ", "
              )}`,
              taskId,
            };
          }

          // Validate task exists and is swapped
          if (!task) {
            return {
              success: false,
              error: `Task '${taskId}' not found`,
              taskId,
            };
          }

          if (!swappedTasks.has(resolvedTaskId)) {
            return {
              success: false,
              error: `Task '${resolvedTaskId}' is not swapped`,
              taskId: resolvedTaskId,
            };
          }

          // Remove swapped run and interceptor wiring for this task.
          swappedRunFunctions.delete(resolvedTaskId);
          removeSwapInterceptor(resolvedTaskId);
          invalidateTaskRunnerCache(resolvedTaskId);

          // Clean up tracking
          originalRunCodeByTaskId.delete(resolvedTaskId);
          swappedTasks.delete(resolvedTaskId);

          return { success: true, taskId: resolvedTaskId };
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
        const { taskId: resolvedTaskId, ambiguousTaskIds } =
          resolveTaskReference(taskId);

        if (ambiguousTaskIds.length > 1) {
          return false;
        }

        return swappedRunFunctions.has(resolvedTaskId);
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
          const {
            task,
            taskId: resolvedTaskId,
            ambiguousTaskIds,
          } = resolveTaskReference(taskId);

          if (ambiguousTaskIds.length > 1) {
            return {
              success: false,
              error: `Task '${taskId}' is ambiguous. Use one of: ${ambiguousTaskIds.join(
                ", "
              )}`,
              taskId,
              invocationId,
            };
          }

          // Validate task exists
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
                taskId: resolvedTaskId,
                invocationId,
              };
            }
          }

          // Execute exactly once based on mode
          let result: any;
          try {
            if (pure) {
              // Pure mode: Get computed dependencies from store (no middleware pipeline)
              const dependencies = getTaskDependencies(store, resolvedTaskId);
              const swappedRun = swappedRunFunctions.get(resolvedTaskId);
              if (swappedRun) {
                result = await swappedRun(input, dependencies);
              } else {
                result = await task.run(input, dependencies);
              }
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
              taskId: resolvedTaskId,
              executionTimeMs,
              invocationId,
            };
          }

          // Serialize result
          const serializedResult = serializeResult(result);
          const executionTimeMs = Date.now() - startTime;

          return {
            success: true,
            taskId: resolvedTaskId,
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

      async invokeEvent(
        eventId: string,
        inputJson?: string,
        evalInput?: boolean
      ): Promise<InvokeEventResult> {
        const invocationId = randomUUID();
        const { event, ambiguousEventIds } = resolveEventReference(eventId);

        if (ambiguousEventIds.length > 1) {
          return {
            success: false,
            error: `Event '${eventId}' is ambiguous. Use one of: ${ambiguousEventIds.join(
              ", "
            )}`,
            invocationId,
          };
        }

        if (!event) {
          return {
            success: false,
            error: `Event '${eventId}' not found`,
            invocationId,
          };
        }

        let input: any = undefined;
        if (inputJson) {
          if (evalInput) {
            input = eval(`(${inputJson})`);
          } else {
            input = deserializeInput(inputJson);
          }
        }

        const startTime = Date.now();
        await eventManager.emit(event, input, {
          kind: "runtime",
          id: swapManager.id,
        });
        const executionTimeMs = Date.now() - startTime;

        return { success: true, executionTimeMs, invocationId };
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
            globals: resources,
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
