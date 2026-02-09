import { globals, resource, run, task } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import type { Request, Response } from "express";
import { createDocsDataRouteHandler } from "../../resources/routeHandlers/getDocsData";
import { Introspector } from "../../resources/models/Introspector";

function createDurableDocsFixtureApp() {
  const durable = memoryDurableResource.fork("tests.docs.durable.runtime");
  const durableRegistration = durable.with({});

  const durableWorkflowTask = task({
    id: "tests.docs.tasks.durableWorkflow",
    dependencies: { durable },
    tags: [durableWorkflowTag],
    async run(_input, { durable }) {
      const ctx = durable.use();
      await ctx.step("validate", async () => true);
      await ctx.note("ok");
      return "ok";
    },
  });

  const runWorkflowTask = task({
    id: "tests.docs.tasks.runDurableWorkflow",
    dependencies: { durable, durableWorkflowTask },
    async run(input, { durable, durableWorkflowTask }) {
      return durable.execute(durableWorkflowTask, input);
    },
  });

  const app = resource({
    id: "tests.docs.app",
    register: [durableRegistration, durableWorkflowTask, runWorkflowTask],
  });

  return { app, durableWorkflowTask, runWorkflowTask };
}

function createMockReqRes() {
  const payloadRef: { value: any } = { value: null };
  const req = { query: {} } as Request;
  const res = {
    setHeader: (_name: string, _value: string) => res,
    json: (payload: any) => {
      payloadRef.value = payload;
      return res;
    },
  } as unknown as Response;

  return { req, res, payloadRef };
}

describe("/docs/data durable enrichment", () => {
  test("sets durable metadata and defers flow shape computation", async () => {
    const { app, durableWorkflowTask, runWorkflowTask } =
      createDurableDocsFixtureApp();
    const runtime = await run(app);

    try {
      const store = await runtime.getResourceValue(globals.resources.store);
      const introspector = new Introspector({ store });
      const handler = createDocsDataRouteHandler({
        uiDir: ".",
        store,
        introspector,
        logger: { info: () => undefined },
      });

      const { req, res, payloadRef } = createMockReqRes();
      await handler(req, res);

      const tasks: any[] = payloadRef.value?.introspectorData?.tasks || [];
      const workflow = tasks.find((item) => item.id === durableWorkflowTask.id);
      const runner = tasks.find((item) => item.id === runWorkflowTask.id);

      expect(workflow?.isDurable).toBe(true);
      expect(workflow?.flowShape).toBeNull();
      expect(runner?.isDurable).toBe(false);
      expect(runner?.flowShape).toBeNull();
    } finally {
      await runtime.dispose();
    }
  });
});
