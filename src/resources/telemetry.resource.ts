import { resources, defineResource, type Store } from "@bluelibs/runner";
import { graphqlQueryCliTask } from "./graphql.query.cli.task";
import { graphqlQueryTask } from "./graphql.query.task";
import { live } from "./live.resource";
import { deriveParentAndRoot, withTaskRunContext } from "./telemetry.chain";

const RUNNER_DEV_INTERNAL_TASK_DEFINITIONS = [
  graphqlQueryTask,
  graphqlQueryCliTask,
];

function getRunnerDevInternalTaskIds(store: Store): Set<string> {
  const taskIds = new Set<string>();

  for (const definition of RUNNER_DEV_INTERNAL_TASK_DEFINITIONS) {
    if (!store.hasDefinition(definition)) {
      continue;
    }

    taskIds.add(store.findIdByDefinition(definition));
  }

  return taskIds;
}

function isRunnerDevInternalNodeId(
  nodeId: string,
  runnerDevInternalTaskIds: ReadonlySet<string>
): boolean {
  return runnerDevInternalTaskIds.has(nodeId);
}

const overrideEventManagerEmittor = defineResource({
  id: "overrideEventManagerEmittor",
  meta: {
    title: "Override event manager emittor",
    description:
      "Overrides the event manager emittor to record telemetry, no other changes are made to the input.",
  },
  dependencies: { eventManager: resources.eventManager, live },
  async init(_, { eventManager, live }) {
    eventManager.intercept((next, emission) => {
      return withTaskRunContext(emission.id, async () => {
        const emitterId =
          typeof emission?.source === "string"
            ? emission.source
            : emission?.source?.id ?? null;
        live.recordEmission(emission.id, emission.data, emitterId);
        return next(emission);
      });
    });
  },
});

const hookInterceptors = defineResource({
  id: "hookInterceptors",
  meta: {
    title: "Hook Interceptors",
    description:
      "Intercepts hook execution to record telemetry data including execution time, success/failure status, and correlation",
  },
  dependencies: { live, eventManager: resources.eventManager },
  async init(_, { live, eventManager }) {
    eventManager.interceptHook(async (next, hook, emission) => {
      const startedAt = Date.now();
      const { parentId, rootId } = deriveParentAndRoot(hook.id);
      let error = undefined;
      try {
        const result = await next(hook, emission);
        return result;
      } catch (_error) {
        live.recordError(hook.id, "HOOK", _error);
        error = _error;
        throw _error;
      } finally {
        const durationMs = Date.now() - startedAt;
        live.recordRun(
          hook.id,
          "HOOK",
          durationMs,
          !error,
          undefined,
          parentId,
          rootId
        );
      }
    });
  },
});

const taskInterceptors = defineResource({
  id: "taskInterceptors",
  meta: {
    title: "Telemetry Task Interceptors",
    description:
      "Registers runtime task interceptors to track execution metrics including duration, success/failure, and correlation data",
  },
  dependencies: {
    live,
    store: resources.store,
    taskRunner: resources.taskRunner,
  },
  async init(_, { live, store, taskRunner }) {
    const runnerDevInternalTaskIds = getRunnerDevInternalTaskIds(store);

    taskRunner.intercept(async (next, input) => {
      const id = String(input.task.definition.id);

      // Skip internal dev tools nodes to avoid self-instrumentation
      if (isRunnerDevInternalNodeId(id, runnerDevInternalTaskIds)) {
        return next(input);
      }

      const { parentId, rootId } = deriveParentAndRoot(id);

      const startedAt = Date.now();
      return withTaskRunContext(id, async () => {
        try {
          const result = await next(input);
          const durationMs = Date.now() - startedAt;
          live.recordRun(
            id,
            "TASK",
            durationMs,
            true,
            undefined,
            parentId,
            rootId
          );
          return result as any;
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          // Best-effort error capture via Live (errors buffer)
          live.recordError(id, "TASK", error);

          try {
            live.recordRun(
              id,
              "TASK",
              durationMs,
              false,
              error,
              parentId,
              rootId
            );
          } catch {
            // ignore if live lacks recordRun
          }
          throw error;
        }
      });
    });
  },
});

export const telemetry = defineResource({
  id: "telemetry",
  meta: {
    title: "Telemetry System",
    description:
      "Comprehensive telemetry system that intercepts tasks, hooks, and events to collect performance and execution data",
  },
  register: [taskInterceptors, overrideEventManagerEmittor, hookInterceptors],
  async init() {
    // no-op
  },
});
