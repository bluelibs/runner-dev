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
    const originalEmit = eventManager.emit.bind(eventManager);
    eventManager.emit = async (event, ...args) => {
      return withTaskRunContext(event.id, async () => {
        await originalEmit(event, ...args);
      });
    };
  },
});
const onHookCompleted = hook({
  id: "runner-dev.telemetry.hooks.completed",
  on: globals.events.hookCompleted,
  dependencies: { live },
  async run(event, { live }) {
    const { hook, eventId } = event.data;
    const { parentId, rootId } = deriveParentAndRoot(hook.id);

    // If they don't exist, it means they are the root of the chain
    // Since we cannot use middleware() strategy here, we will use uuid() to

    live.recordRun(hook.id, "HOOK", 0, true, undefined, parentId, rootId);
  },
});

const onHookTriggered = hook({
  id: "runner-dev.telemetry.hooks.triggered",
  on: globals.events.hookTriggered,
  dependencies: { live },
  async run(event, { live }) {
    const { hook, eventId } = event.data;
    const { parentId, rootId } = deriveParentAndRoot(hook.id);

    live.recordRun(hook.id, "HOOK", 0, true, undefined, parentId, rootId);
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
        try {
          live.recordRun(
            id,
            "TASK",
            durationMs,
            true,
            undefined,
            parentId,
            rootId
          );
        } catch {
          // ignore if live lacks recordRun
        }
        return result as any;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        // Best-effort error capture via Live (errors buffer)
        try {
          (live as any).recordError?.(id, "TASK", error);
        } catch {
          // ignore
        }
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
    onHookCompleted,
    onHookTriggered,
  ],
  async init() {
    // no-op
  },
});
