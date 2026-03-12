import { defineTaskMiddleware, r, run } from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Subtree Introspection", () => {
  test("merges subtree policy arrays into a single summary", async () => {
    const acceptDefinition = () => [];

    const auditTaskMiddleware = defineTaskMiddleware({
      id: "test-subtree-audit",
      async run({ next }) {
        return next();
      },
    });
    const authTaskMiddleware = defineTaskMiddleware({
      id: "test-subtree-auth",
      async run({ next }) {
        return next();
      },
    });
    const childTask = r
      .task("test-subtree-child-task")
      .run(async () => "ok")
      .build();

    const moduleResource = r
      .resource("test-subtree-module")
      .subtree([
        {
          tasks: {
            middleware: [auditTaskMiddleware],
            validate: [acceptDefinition],
          },
          hooks: {
            validate: [acceptDefinition],
          },
        },
        {
          tasks: {
            middleware: [authTaskMiddleware],
            validate: [acceptDefinition, acceptDefinition],
          },
          resources: {
            validate: [acceptDefinition],
          },
          events: {
            validate: [acceptDefinition],
          },
        },
      ])
      .register([auditTaskMiddleware, authTaskMiddleware, childTask])
      .build();

    const appId = "test-subtree-app";
    const moduleId = `${appId}.test-subtree-module`;
    const app = r.resource(appId).register([moduleResource]).build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const resource = introspector.getResource(moduleId);
      expect(resource?.subtree).toEqual({
        tasks: {
          middleware: [
            `${moduleId}.middleware.task.${auditTaskMiddleware.id}`,
            `${moduleId}.middleware.task.${authTaskMiddleware.id}`,
          ],
          validatorCount: 3,
        },
        resources: {
          middleware: [],
          validatorCount: 1,
        },
        hooks: {
          validatorCount: 1,
        },
        taskMiddleware: null,
        resourceMiddleware: null,
        events: {
          validatorCount: 1,
        },
        tags: null,
      });
    } finally {
      await runtime.dispose();
    }
  });
});
