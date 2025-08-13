import { middleware, resource } from "@bluelibs/runner";
import { live } from "./live.resource";
import { deriveParentAndRoot, withTaskRunContext } from "./dev.telemetry.chain";

const telemetryMiddleware = middleware({
  id: "runner-dev.telemetry.middleware",
  dependencies: { live },
  async run({ task, next }, { live }) {
    // For typesafety, this only runs for tasks
    if (!task) {
      return;
    }
    const id = String(task.definition.id);

    // Skip internal dev tools nodes to avoid self-instrumentation
    if (id.startsWith("runner-dev.")) {
      return next(task.input as any);
    }

    const nodeKind: "TASK" | "LISTENER" = task.definition.on
      ? "LISTENER"
      : "TASK";

    const { parentId, rootId } = deriveParentAndRoot(id);

    const startedAt = Date.now();
    return withTaskRunContext(id, async () => {
      try {
        const result = await next(task.input);
        const durationMs = Date.now() - startedAt;
        try {
          live.recordRun(
            id,
            nodeKind,
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
          (live as any).recordError?.(id, nodeKind, error);
        } catch {
          // ignore
        }
        try {
          live.recordRun(
            id,
            nodeKind,
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
  register: [telemetryMiddleware.everywhere({ tasks: true, resources: false })],
  async init() {
    // no-op
  },
});
