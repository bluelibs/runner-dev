import { globals, hook, resource, taskMiddleware } from "@bluelibs/runner";
import { live } from "./live.resource";
import { deriveParentAndRoot, withTaskRunContext } from "./telemetry.chain";

const overrideEventManagerEmittor = resource({
  id: "runner-dev.telemetry.overrideEventManagerEmittor",
  meta: {
    title: "Override event manager emittor",
    description:
      "Overrides the event manager emittor to record telemetry, no other changes are made to the input.",
  },
  dependencies: { eventManager: globals.resources.eventManager, live },
  async init(_, { eventManager, live }) {
    eventManager.intercept((next, emission) => {
      return withTaskRunContext(emission.id, async () => {
        live.recordEmission(emission.id, emission.data, emission.source);
        return next(emission);
      });
    });
  },
});

const hookInterceptors = resource({
  id: "runner-dev.telemetry.resources.hookInterceptors",
  dependencies: { live, eventManager: globals.resources.eventManager },
  async init(_, { live, eventManager }) {
    eventManager.interceptHook(async (next, hook, emission) => {
      const startedAt = Date.now();
      const { parentId, rootId } = deriveParentAndRoot(hook.id);
      let error = undefined;
      try {
        const result = await next(hook, emission);
        return result;
      } catch (error) {
        live.recordError(hook.id, "HOOK", error);
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

const telemetryMiddleware = taskMiddleware({
  everywhere: true,
  id: "runner-dev.telemetry.middleware",
  dependencies: { live },
  async run({ task, next }, { live }) {
    const id = String(task.definition.id);

    // Skip internal dev tools nodes to avoid self-instrumentation
    if (id.startsWith("runner-dev.")) {
      return next(task.input as any);
    }

    const { parentId, rootId } = deriveParentAndRoot(id);

    const startedAt = Date.now();
    return withTaskRunContext(id, async () => {
      try {
        const result = await next(task.input);
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
  },
});

export const telemetry = resource({
  id: "runner-dev.telemetry",
  register: [
    telemetryMiddleware,
    overrideEventManagerEmittor,
    hookInterceptors,
  ],
  async init() {
    // no-op
  },
});
