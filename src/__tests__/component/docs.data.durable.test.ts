import { resources, defineResource, run, defineTask } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import type { Request, Response } from "express";
import { createDocsDataRouteHandler } from "../../resources/routeHandlers/getDocsData";
import * as packageDocs from "../../docs/packageDocs";
import { Introspector } from "../../resources/models/Introspector";

function createDurableDocsFixtureApp() {
  const appId = "tests-docs-app";
  const taskId = (localId: string) => `${appId}.tasks.${localId}`;

  const durable = memoryDurableResource.fork("tests-docs-durable-runtime");
  if (!durable?.id) {
    throw new Error(
      "memoryDurableResource.fork() did not return a valid resource"
    );
  }

  const durableRegistration = durable.with({});

  const durableWorkflowTask = defineTask({
    id: "tests-docs-tasks-durableWorkflow",
    dependencies: { durable },
    tags: [durableWorkflowTag],
    async run(_input, { durable }) {
      const ctx = durable.use();
      await ctx.step("validate", async () => true);
      await ctx.note("ok");
      return "ok";
    },
  });

  const runWorkflowTask = defineTask({
    id: "tests-docs-tasks-runDurableWorkflow",
    dependencies: { durable, durableWorkflowTask },
    async run(input, { durable }) {
      return durable.startAndWait(taskId(durableWorkflowTask.id), input);
    },
  });

  const app = defineResource({
    id: appId,
    register: [
      durableWorkflowTag,
      durableRegistration,
      durableWorkflowTask,
      runWorkflowTask,
    ],
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
      const store = await runtime.getResourceValue(resources.store);
      const introspector = new Introspector({ store });
      const handler = createDocsDataRouteHandler({
        store,
        introspector,
        logger: { info: () => undefined },
      });

      const { req, res, payloadRef } = createMockReqRes();
      await handler(req, res);

      const tasks: any[] = payloadRef.value?.introspectorData?.tasks || [];
      const workflow = tasks.find(
        (item) => item.id === `tests-docs-app.tasks.${durableWorkflowTask.id}`
      );
      const runner = tasks.find(
        (item) => item.id === `tests-docs-app.tasks.${runWorkflowTask.id}`
      );

      expect(workflow?.isDurable).toBe(true);
      expect(runner?.isDurable).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });

  test("fails when a required Runner guide is missing", async () => {
    const { app } = createDurableDocsFixtureApp();
    const runtime = await run(app);
    let readFirstAvailablePackageDocSpy: jest.SpyInstance | null = null;

    try {
      const store = await runtime.getResourceValue(resources.store);
      const introspector = new Introspector({ store });
      const handler = createDocsDataRouteHandler({
        store,
        introspector,
        logger: { info: () => undefined },
      });

      const originalReadFirstAvailablePackageDoc =
        packageDocs.readFirstAvailablePackageDoc;
      readFirstAvailablePackageDocSpy = jest
        .spyOn(packageDocs, "readFirstAvailablePackageDoc")
        .mockImplementation(async (packageName, docPaths) => {
          if (
            packageName === "@bluelibs/runner" &&
            docPaths.includes(
              packageDocs.RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS[0]
            )
          ) {
            throw new Error("missing full guide");
          }

          return originalReadFirstAvailablePackageDoc(packageName, docPaths);
        });

      const { req, res, payloadRef } = createMockReqRes();
      await expect(handler(req, res)).rejects.toThrow("missing full guide");
      expect(payloadRef.value).toBeNull();
    } finally {
      readFirstAvailablePackageDocSpy?.mockRestore();
      await runtime.dispose();
    }
  });
});
