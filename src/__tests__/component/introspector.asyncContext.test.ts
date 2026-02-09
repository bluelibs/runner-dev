import { r, resource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";

describe("introspector (async context usage)", () => {
  test("tracks usedBy (dependency) and requiredBy (.require()) for async contexts", async () => {
    let snapshot: any = {};

    // Define async contexts
    const RequestCtx = r
      .asyncContext<{ requestId: string }>("test.ctx.request")
      .build();

    const TenantCtx = r
      .asyncContext<{ tenantId: string }>("test.ctx.tenant")
      .build();

    // Task that uses context as dependency only
    const depOnlyTask = r
      .task("test.tasks.depOnly")
      .dependencies({ ctx: RequestCtx })
      .run(async () => "ok")
      .build();

    // Task that uses .require() only
    const requireOnlyTask = r
      .task("test.tasks.requireOnly")
      .middleware([RequestCtx.require()])
      .run(async () => "ok")
      .build();

    // Task that uses both dependency AND .require()
    const bothTask = r
      .task("test.tasks.both")
      .dependencies({ ctx: TenantCtx })
      .middleware([TenantCtx.require()])
      .run(async () => "ok")
      .build();

    // Resource that depends on a context
    const dbResource = r
      .resource("test.resources.db")
      .dependencies({ ctx: RequestCtx })
      .init(async () => ({ connected: true }))
      .build();

    // Middleware that depends on a context
    const auditMiddleware = r.middleware
      .task("test.middleware.audit")
      .dependencies({ ctx: TenantCtx })
      .run(async ({ next, task }) => next(task.input))
      .build();

    // Hook that depends on a context
    const someEvent = r.event("test.events.something").build();
    const ctxHook = r
      .hook("test.hooks.ctxHook")
      .on(someEvent)
      .dependencies({ ctx: RequestCtx })
      .run(async () => {})
      .build();

    const probe = resource({
      id: "test.probe.asyncCtx",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const requestCtx = introspector.getAsyncContext("test.ctx.request");
        const tenantCtx = introspector.getAsyncContext("test.ctx.tenant");

        const requestUsedByTasks = introspector
          .getTasksUsingContext("test.ctx.request")
          .map((t) => t.id);
        const requestUsedByResources = introspector
          .getResourcesUsingContext("test.ctx.request")
          .map((r) => r.id);
        const requestUsedByHooks = introspector
          .getHooksUsingContext("test.ctx.request")
          .map((h) => h.id);
        const requestRequiredByTasks = introspector
          .getTasksRequiringContext("test.ctx.request")
          .map((t) => t.id);

        const tenantUsedByTasks = introspector
          .getTasksUsingContext("test.ctx.tenant")
          .map((t) => t.id);
        const tenantUsedByMiddlewares = introspector
          .getMiddlewaresUsingContext("test.ctx.tenant")
          .map((m) => m.id);
        const tenantRequiredByTasks = introspector
          .getTasksRequiringContext("test.ctx.tenant")
          .map((t) => t.id);

        snapshot = {
          request: {
            usedBy: requestCtx?.usedBy ?? [],
            requiredBy: requestCtx?.requiredBy ?? [],
            usedByTasks: requestUsedByTasks,
            usedByResources: requestUsedByResources,
            usedByHooks: requestUsedByHooks,
            requiredByTasks: requestRequiredByTasks,
            isRequiredByDepOnly: introspector.isContextRequiredBy(
              "test.ctx.request",
              "test.tasks.depOnly"
            ),
            isRequiredByRequireOnly: introspector.isContextRequiredBy(
              "test.ctx.request",
              "test.tasks.requireOnly"
            ),
          },
          tenant: {
            usedBy: tenantCtx?.usedBy ?? [],
            requiredBy: tenantCtx?.requiredBy ?? [],
            usedByTasks: tenantUsedByTasks,
            usedByMiddlewares: tenantUsedByMiddlewares,
            requiredByTasks: tenantRequiredByTasks,
            isRequiredByBoth: introspector.isContextRequiredBy(
              "test.ctx.tenant",
              "test.tasks.both"
            ),
          },
        };
      },
    });

    const app = r
      .resource("test.app.asyncCtx")
      .register([
        RequestCtx,
        TenantCtx,
        depOnlyTask,
        requireOnlyTask,
        bothTask,
        dbResource,
        auditMiddleware,
        someEvent,
        ctxHook,
        introspector,
        probe,
      ])
      .build();

    await run(app, { logs: false });

    // RequestCtx: used as dependency by depOnlyTask, dbResource, ctxHook
    // RequestCtx: required by requireOnlyTask
    expect(snapshot.request.usedBy).toEqual(
      expect.arrayContaining([
        "test.tasks.depOnly",
        "test.resources.db",
        "test.hooks.ctxHook",
      ])
    );
    expect(snapshot.request.usedBy).not.toContain("test.tasks.requireOnly");
    expect(snapshot.request.requiredBy).toEqual(["test.tasks.requireOnly"]);

    expect(snapshot.request.usedByTasks).toEqual(["test.tasks.depOnly"]);
    expect(snapshot.request.usedByResources).toEqual(["test.resources.db"]);
    expect(snapshot.request.usedByHooks).toEqual(["test.hooks.ctxHook"]);
    expect(snapshot.request.requiredByTasks).toEqual([
      "test.tasks.requireOnly",
    ]);

    // isContextRequiredBy checks
    expect(snapshot.request.isRequiredByDepOnly).toBe(false);
    expect(snapshot.request.isRequiredByRequireOnly).toBe(true);

    // TenantCtx: used as dependency by bothTask and auditMiddleware
    // TenantCtx: required by bothTask
    expect(snapshot.tenant.usedBy).toEqual(
      expect.arrayContaining(["test.tasks.both", "test.middleware.audit"])
    );
    expect(snapshot.tenant.requiredBy).toEqual(["test.tasks.both"]);
    expect(snapshot.tenant.usedByTasks).toEqual(["test.tasks.both"]);
    expect(snapshot.tenant.usedByMiddlewares).toEqual([
      "test.middleware.audit",
    ]);
    expect(snapshot.tenant.requiredByTasks).toEqual(["test.tasks.both"]);
    expect(snapshot.tenant.isRequiredByBoth).toBe(true);
  });
});
