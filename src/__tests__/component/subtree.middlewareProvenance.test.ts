import { defineTaskMiddleware, middleware, r, run } from "@bluelibs/runner";
import type { Store } from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";
import { mapStoreResourceToResourceModel } from "../../resources/models/initializeFromStore.utils";

const IDENTITY_CHECKER_ID = "runner.middleware.task.identityChecker";

async function introspect(app: Parameters<typeof run>[0]) {
  const runtime = await run(app, { debug: {} });
  const introspector = new Introspector({ store: runtime.store });
  initializeFromStore(introspector, runtime.store);
  return { runtime, introspector };
}

describe("subtree middleware provenance", () => {
  test("credits each identity gate to the owner whose tasks.identity required it", async () => {
    const task = r
      .task("provenance-identity-task")
      .run(async () => "ok")
      .build();
    // The inner owner also lists identityChecker in tasks.middleware, so
    // both stack entries share one duplicate key: only their position tells
    // which owner applied which.
    const inner = r
      .resource("inner")
      .subtree({
        tasks: {
          middleware: [middleware.task.identityChecker.with({ user: true })],
        },
      })
      .register([task])
      .build();
    const outer = r
      .resource("outer")
      .subtree({ tasks: { identity: { tenant: true } } })
      .register([inner])
      .build();
    const app = r.resource("provenance-app").register([outer]).build();

    const { runtime, introspector } = await introspect(app);
    try {
      const outerId = runtime.store.findIdByDefinition(outer);
      const innerId = runtime.store.findIdByDefinition(inner);
      const taskId = runtime.store.findIdByDefinition(task)!;

      // Runner normalizes the gate's requirement, so config is not pinned.
      const provenance = introspector
        .getTask(taskId)
        ?.middlewareDetailed?.map(({ id, origin, subtreeOwnerId }) => ({
          id,
          origin,
          subtreeOwnerId,
        }));
      expect(provenance).toEqual([
        { id: IDENTITY_CHECKER_ID, origin: "subtree", subtreeOwnerId: outerId },
        { id: IDENTITY_CHECKER_ID, origin: "subtree", subtreeOwnerId: innerId },
      ]);
      // The middleware-side view lists the task once, by its first usage.
      expect(
        introspector
          .getTasksUsingMiddlewareDetailed(IDENTITY_CHECKER_ID)
          .map(({ id, origin, subtreeOwnerId }) => ({
            id,
            origin,
            subtreeOwnerId,
          }))
      ).toEqual([{ id: taskId, origin: "subtree", subtreeOwnerId: outerId }]);
    } finally {
      await runtime.dispose();
    }
  });

  test("labels a task's own middleware local when Runner rejects a subtree/local conflict", async () => {
    const audit = defineTaskMiddleware({
      id: "provenance-audit",
      async run({ next }) {
        return next();
      },
    });
    // Runner reports this conflict only when the task runs, so the app
    // boots and introspection must describe what the task itself declares.
    const task = r
      .task("provenance-conflict-task")
      .middleware([audit.with({ local: true })])
      .run(async () => "ok")
      .build();
    const moduleResource = r
      .resource("provenance-module")
      .subtree({ tasks: { middleware: [audit] } })
      .register([audit, task])
      .build();
    const app = r
      .resource("provenance-conflict-app")
      .register([moduleResource])
      .build();

    const { runtime, introspector } = await introspect(app);
    try {
      const taskId = runtime.store.findIdByDefinition(task)!;
      await expect(runtime.runTask(task)).rejects.toThrow("conflicts");

      expect(introspector.getTask(taskId)?.middlewareDetailed).toEqual([
        {
          id: runtime.store.findIdByDefinition(audit),
          config: JSON.stringify({ local: true }),
          origin: "local",
          subtreeOwnerId: null,
        },
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  test("labels a resource's own middleware local when the resolver refuses it", () => {
    const ownerId = "provenance-resource-owner";
    const resourceId = `${ownerId}.child`;
    const lockId = `${ownerId}.middleware.resource.lock`;
    const store = {
      getOwnerResourceId: (id: string) => (id === resourceId ? ownerId : null),
      resources: new Map([
        [
          ownerId,
          {
            resource: {
              id: ownerId,
              subtree: { resources: { middleware: [lockId] } },
            },
          },
        ],
      ]),
      getMiddlewareManager: () => ({
        middlewareResolver: {
          getApplicableResourceMiddlewares: () => {
            throw new Error("subtree conflict");
          },
        },
      }),
    };

    const resource = mapStoreResourceToResourceModel(
      {
        id: resourceId,
        register: [],
        overrides: [],
        middleware: [{ id: lockId, config: { local: true } }],
      } as never,
      undefined,
      // Only the members above are read on this path.
      store as unknown as Store
    );

    expect(resource.middlewareDetailed).toEqual([
      {
        id: lockId,
        config: JSON.stringify({ local: true }),
        origin: "local",
        subtreeOwnerId: null,
      },
    ]);
  });
});
