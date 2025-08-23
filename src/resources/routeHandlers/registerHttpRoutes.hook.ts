import express from "express";
import { globals, hook } from "@bluelibs/runner";
import { httpTag } from "../http.tag";
import { serverResource } from "../server.resource";

export const registerHttpRoutes = hook({
  id: "runner-dev.hooks.registerHttpRoutes",
  on: globals.events.ready,
  dependencies: { store: globals.resources.store, server: serverResource },
  async run(_e, { store, server }) {
    const tasks = store.getTasksWithTag(httpTag.id);
    if (!tasks || tasks.length === 0) return;

    // Access express app exposed by server resource
    const app: express.Express | undefined = (server as any).app;
    if (!app) return;

    for (const task of tasks) {
      const cfg = httpTag.extract(task.meta?.tags || []);
      const method = (cfg as any)?.method as string | undefined;
      const path = (cfg as any)?.path as string | undefined;
      if (!method || !path) continue;
      const handler = async (req: express.Request, res: express.Response) => {
        try {
          // Merge body, params, query for convenience
          const input = {
            ...(req.body || {}),
            ...(req.params || {}),
            ...(req.query || {}),
          };
          const result = await (task as any)(input);
          res.json(result);
        } catch (err: any) {
          res.status(500).json({ error: err?.message || "Internal error" });
        }
      };
      (app as any)[String(method).toLowerCase()](path, handler);
    }
  },
});
