import express from "express";
import { globals, hook } from "@bluelibs/runner";
import { httpTag } from "../http.tag";
import { serverResource } from "../server.resource";

export const registerHttpRoutes = hook({
  id: "runner-dev.hooks.registerHttpRoutes",
  on: globals.events.ready,
  dependencies: {
    store: globals.resources.store,
    server: serverResource,
    taskRunner: globals.resources.taskRunner,
  },
  async run(_e, { store, server, taskRunner }) {
    const tasks = store.getTasksWithTag(httpTag.id);
    if (!tasks || tasks.length === 0) return;

    // Access express app exposed by server resource
    const app: express.Express = server.app;

    for (const task of tasks) {
      const cfg = httpTag.extract(task.meta?.tags || [])!;
      const method = cfg.method;
      const path = cfg.path;
      if (!method || !path) continue;
      const handler = async (req: express.Request, res: express.Response) => {
        try {
          // Merge body, params, query for convenience
          const input = {
            ...(req.body || {}),
            ...(req.params || {}),
            ...(req.query || {}),
          };
          const result = await taskRunner.run(task, input);
          res.json(result);
        } catch (err: any) {
          res.status(500).json({ error: err?.message || "Internal error" });
        }
      };
      (app as any)[String(method).toLowerCase()](path, handler);
    }
  },
});
