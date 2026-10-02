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
      const startedAt = performance.now();
      const { parentId, rootId } = deriveParentAndRoot(hook.id);
      return withTaskRunContext(hook.id, async () => {
        let ok = false;
        let hookError: unknown;
        let durationMs = 0;
        try {
          const result = await next(hook, emission);
          durationMs = performance.now() - startedAt;
          ok = true;
          return result;
        } catch (error) {
          durationMs = performance.now() - startedAt;
          hookError = error;
          live.recordError(hook.id, "HOOK", error);
          throw error;
        } finally {
          live.recordRun(
            hook.id,
            "HOOK",
            durationMs,
            ok,
            hookError,
            parentId,
            rootId
          );
        }
      });
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

      const startedAt = performance.now();
      return withTaskRunContext(id, async () => {
        let ok = false;
        let taskError: unknown;
        let durationMs = 0;
        try {
          const result = await next(input);
          durationMs = performance.now() - startedAt;
          ok = true;
          return result;
        } catch (error) {
          durationMs = performance.now() - startedAt;
          taskError = error;
          live.recordError(id, "TASK", error);
          throw error;
        } finally {
          live.recordRun(
            id,
            "TASK",
            durationMs,
            ok,
            taskError,
            parentId,
            rootId
          );
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
