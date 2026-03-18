import { defineTaskMiddleware, r, run, tags } from "@bluelibs/runner";
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
        middleware: null,
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

  test("renders the effective task middleware stack with subtree provenance and identity scope", async () => {
    const subtreeTaskMiddleware = defineTaskMiddleware({
      id: "test-subtree-effective-audit",
      async run({ next }) {
        return next();
      },
    });
    const localIdentityScopedMiddleware = defineTaskMiddleware({
      id: "test-subtree-effective-local",
      tags: [tags.identityScoped],
      async run({ next }) {
        return next();
      },
    });
    const childTask = r
      .task("test-subtree-effective-child-task")
      .middleware([localIdentityScopedMiddleware])
      .run(async () => "ok")
      .build();

    const moduleResource = r
      .resource("test-subtree-effective-module")
      .subtree({
        tasks: {
          middleware: [subtreeTaskMiddleware],
          identity: { user: true, roles: ["ADMIN"] },
        },
        middleware: {
          identityScope: { tenant: true, user: true },
        },
      })
      .register([
        subtreeTaskMiddleware,
        localIdentityScopedMiddleware,
        childTask,
      ])
      .build();

    const app = r
      .resource("test-subtree-effective-app")
      .register([moduleResource])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const taskId = runtime.store.findIdByDefinition(childTask)!;
      const task = introspector.getTask(taskId);
      const subtreeMiddlewareId = runtime.store.findIdByDefinition(
        subtreeTaskMiddleware
      )!;
      const identityCheckerId = "runner.middleware.task.identityChecker";
      const localMiddlewareId = runtime.store.findIdByDefinition(
        localIdentityScopedMiddleware
      )!;
      const subtreeMiddleware = introspector.getMiddleware(subtreeMiddlewareId);
      const resource = introspector.getResource(
        runtime.store.findIdByDefinition(moduleResource)!
      );

      expect(task?.middleware).toEqual([
        identityCheckerId,
        subtreeMiddlewareId,
        localMiddlewareId,
      ]);
      expect(task?.middlewareDetailed).toEqual([
        {
          id: identityCheckerId,
          config: JSON.stringify({
            tenant: true,
            user: true,
            roles: ["ADMIN"],
          }),
          origin: "local",
          subtreeOwnerId: null,
        },
        {
          id: subtreeMiddlewareId,
          config: "{}",
          origin: "subtree",
          subtreeOwnerId: resource?.id ?? null,
        },
        {
          id: localMiddlewareId,
          config: JSON.stringify({
            identityScope: { tenant: true, user: true },
          }),
          origin: "local",
          subtreeOwnerId: null,
        },
      ]);

      expect(subtreeMiddleware?.usedByTasks).toEqual([taskId]);
      expect(resource?.subtree).toEqual({
        tasks: {
          middleware: [subtreeMiddlewareId],
          validatorCount: 0,
          identity: [{ tenant: true, user: true, roles: ["ADMIN"] }],
        },
        middleware: {
          identityScope: {
            tenant: true,
            user: true,
            required: true,
          },
        },
        resources: null,
        hooks: null,
        taskMiddleware: null,
        resourceMiddleware: null,
        events: null,
        tags: null,
      });
    } finally {
      await runtime.dispose();
    }
  });
});
