import { resource, run, globals, event, task } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp } from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";

/**
 * This test executes a deep GraphQL query against the built schema
 * using the same GraphQLContext shape the server would provide.
 */
describe("GraphQL schema (integration)", () => {
  test("deep query returns rich graph", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-1",
      dependencies: { introspector, store: globals.resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          // Minimal GraphQLContext required by resolvers
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    // Add an explicit orphan event for filter testing
    const orphanEvt = event({ id: "evt.readme.orphan" });
    const app = createDummyApp([introspector, orphanEvt, probe]);
    await run(app);

    const query = `
      query DeepGraph {
        root {
          id
          filePath
          markdownDescription
        }
        runOptions {
          mode
          debug
          debugMode
          logsEnabled
          logsPrintThreshold
          logsPrintStrategy
          logsBuffer
          errorBoundary
          shutdownHooks
          dryRun
          lazy
          lifecycleMode
          disposeBudgetMs
          disposeDrainBudgetMs
          runtimeEventCycleDetection
          hasOnUnhandledError
          rootId
        }
        interceptorOwners {
          tasksById {
            taskId
            ownerResourceIds
          }
          middleware {
            globalTaskInterceptorOwnerIds
            globalResourceInterceptorOwnerIds
            perTaskMiddlewareInterceptorOwnerIds {
              middlewareId
              ownerResourceIds
            }
            perResourceMiddlewareInterceptorOwnerIds {
              middlewareId
              ownerResourceIds
            }
          }
        }
        tasks {
          id
          isPrivate
          filePath
          fileContents
          fileContentsSliced: fileContents(startLine: 1, endLine: 5)
          markdownDescription
          inputSchema
          inputSchemaReadable
          interceptorCount
          hasInterceptors
          interceptorOwnerIds
          emits
          emitsResolved { id }
          dependsOn
          middleware
          middlewareResolved { id }
          overriddenBy
          registeredBy
          registeredByResolved { id }
          dependsOnResolved {
            tasks { id }
            hooks { id }
            resources { id }
            emitters { id }
          }
          depenendsOnResolved { id }
        }
        hooks {
          id
          event
          filePath
          fileContents
          markdownDescription
          inputSchema
          inputSchemaReadable
          hookOrder
          emits
          emitsResolved { id }
          dependsOn
          middleware
          middlewareResolved { id }
          overriddenBy
          registeredBy
          registeredByResolved { id }
          depenendsOnResolved { id }
        }
        resources {
          id
          isPrivate
          config
          middleware
          middlewareResolved { id }
          overrides
          overridesResolved { id }
          registers
          isolation {
            deny
            only
            exports
            exportsMode
          }
          registersResolved { id }
          usedBy { id }
          emits { id }
          configSchema
          configSchemaReadable
        }
        events { 
          id
          isPrivate
          filePath
          transactional
          parallel
          eventLane { laneId orderingKey metadata }
          payloadSchema
          payloadSchemaReadable
          emittedBy
          emittedByResolved { id }
          listenedToBy
          listenedToByResolved { id }
        }
        eventsWithHooks: events(filter: { hasNoHooks: false }) { id }
        eventsWithoutHooks: events(filter: { hasNoHooks: true }) { id }
        middlewares {
          id
          isPrivate
          usedByTasks
          usedByTasksResolved { id }
          usedByTasksDetailed { id config node { id } }
          usedByResources
          usedByResourcesResolved { id }
          usedByResourcesDetailed { id config node { id } }
          emits { id }
          configSchema
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });

    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    expect(Array.isArray(data?.tasks)).toBe(true);
    expect(Array.isArray(data.hooks)).toBe(true);
    expect(Array.isArray(data.resources)).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.middlewares)).toBe(true);

    // Spot checks
    const helloTask = data.tasks.find((t: any) => t.id === "task.hello");
    expect(typeof helloTask.isPrivate).toBe("boolean");
    expect(typeof helloTask.interceptorCount).toBe("number");
    expect(typeof helloTask.hasInterceptors).toBe("boolean");
    expect(Array.isArray(helloTask.interceptorOwnerIds)).toBe(true);
    expect(helloTask.emits).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(helloTask.emitsResolved.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );

    const evt = data.events.find((e: any) => e.id === "evt.hello");
    expect(Array.isArray(evt.listenedToBy)).toBe(true);

    expect(typeof evt.payloadSchema).toBe("string");
    expect(evt.payloadSchema).toBeTruthy();
    expect(String(evt.payloadSchema)).toContain("name");
    expect(typeof evt.payloadSchemaReadable === "string").toBe(true);
    expect(evt.payloadSchemaReadable).toContain("name");
    // Schemas present and look like JSON
    expect(typeof evt.payloadSchema === "string").toBe(true);

    const mwLog = data.middlewares.find((m: any) => m.id === "mw.log");
    expect(mwLog.usedByResources).toEqual(expect.arrayContaining(["res.db"]));
    // Resource config markdown exists for cacheRes
    const cache = data.resources.find((r: any) => r.id === "res.cache");
    expect(typeof cache.isPrivate).toBe("boolean");
    expect(
      cache.isolation === null || typeof cache.isolation === "object"
    ).toBe(true);
    expect(typeof cache.configSchema).toBe("string");
    expect(cache.configSchema).toBeTruthy();
    expect(String(cache.configSchema)).toContain("ttlMs");
    expect(typeof cache.config).toBe("string");
    expect(String(cache.config)).toContain("ttlMs");
    expect(typeof cache.configSchemaReadable === "string").toBe(true);
    expect(cache.configSchemaReadable).toContain("ttlMs");

    // Filtered events
    const withHooks: string[] = data.eventsWithHooks.map((e: any) => e.id);
    const withoutHooks: string[] = data.eventsWithoutHooks.map(
      (e: any) => e.id
    );
    expect(withHooks).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(withoutHooks).toEqual(expect.arrayContaining(["evt.readme.orphan"]));

    // Explicitly-declared event should have a filePath (comes from store symbol)
    expect(typeof evt.filePath === "string").toBe(true);
    expect(typeof evt.isPrivate).toBe("boolean");
    expect(evt.filePath).toBeTruthy();

    expect(typeof mwLog.isPrivate).toBe("boolean");

    // runOptions
    expect(data.runOptions).toBeDefined();
    expect(typeof data.runOptions.mode).toBe("string");
    expect(["dev", "test", "prod"]).toContain(data.runOptions.mode);
    expect(typeof data.runOptions.debug).toBe("boolean");
    expect(
      data.runOptions.debugMode === null ||
        typeof data.runOptions.debugMode === "string"
    ).toBe(true);
    expect(typeof data.runOptions.logsEnabled).toBe("boolean");
    expect(
      data.runOptions.logsPrintThreshold === null ||
        typeof data.runOptions.logsPrintThreshold === "string"
    ).toBe(true);
    expect(
      data.runOptions.logsPrintStrategy === null ||
        typeof data.runOptions.logsPrintStrategy === "string"
    ).toBe(true);
    expect(typeof data.runOptions.logsBuffer).toBe("boolean");
    expect(
      data.runOptions.errorBoundary === null ||
        typeof data.runOptions.errorBoundary === "boolean"
    ).toBe(true);
    expect(
      data.runOptions.shutdownHooks === null ||
        typeof data.runOptions.shutdownHooks === "boolean"
    ).toBe(true);
    expect(typeof data.runOptions.dryRun).toBe("boolean");
    expect(typeof data.runOptions.lazy).toBe("boolean");
    expect(["sequential", "parallel"]).toContain(data.runOptions.lifecycleMode);
    expect(
      data.runOptions.disposeBudgetMs === null ||
        typeof data.runOptions.disposeBudgetMs === "number"
    ).toBe(true);
    expect(
      data.runOptions.disposeDrainBudgetMs === null ||
        typeof data.runOptions.disposeDrainBudgetMs === "number"
    ).toBe(true);
    expect(
      data.runOptions.runtimeEventCycleDetection === null ||
        typeof data.runOptions.runtimeEventCycleDetection === "boolean"
    ).toBe(true);
    expect(typeof data.runOptions.hasOnUnhandledError).toBe("boolean");
    expect(typeof data.runOptions.rootId).toBe("string");
    expect(data.runOptions.rootId).toBeTruthy();
    expect(data.interceptorOwners).toBeDefined();
    expect(Array.isArray(data.interceptorOwners.tasksById)).toBe(true);
    expect(data.interceptorOwners.middleware).toBeDefined();
  });

  test("deep traversal from task -> middlewareResolved -> dependents", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-2",
      dependencies: { introspector },
      async init(_config, { introspector }) {
        ctx = {
          store: undefined,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    const query = `
      query DeepFromTaskToMiddleware {
        tasks {
          id
          middlewareResolved {
            id
            ... on TaskMiddleware { usedBy { id } }
            emits { id }
          }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    const helloTask = data.tasks.find((t: any) => t.id === "task.hello");
    expect(helloTask).toBeTruthy();
    const mwLog = helloTask.middlewareResolved.find(
      (m: any) => m.id === "mw.log.task"
    );
    expect(mwLog).toBeTruthy();
    // mw.log is used by task.hello and resource res.db
    expect(mwLog.usedBy.map((t: any) => t.id)).toEqual(
      expect.arrayContaining(["task.hello"])
    );
    expect(mwLog.emits.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );
  });

  test("surfaces isolate()-based privacy and task interceptors", async () => {
    let ctx: any;

    const visibilityPublicTask = task({
      id: "task.visibility.public",
      run: async (input: { value: number }) => ({ value: input.value }),
    });

    const visibilityPrivateTask = task({
      id: "task.visibility.private",
      run: async (input: { value: number }) => ({ value: input.value }),
    });

    const visibilityModule = resource({
      id: "res.visibility.module",
      register: [visibilityPublicTask, visibilityPrivateTask],
      isolate: { exports: [visibilityPublicTask] },
    });

    const interceptorInstaller = resource({
      id: "res.visibility.interceptor",
      dependencies: { visibilityPublicTask },
      async init(_config, deps) {
        deps.visibilityPublicTask.intercept(async (next, input) =>
          next({ value: input.value + 1 })
        );
      },
    });

    const probe = resource({
      id: "probe.graphql.visibility",
      dependencies: { introspector, store: globals.resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = resource({
      id: "app.graphql.visibility",
      register: [introspector, visibilityModule, interceptorInstaller, probe],
    });

    await run(app);

    const query = `
      query VisibilityAndInterceptors {
        tasks(idIncludes: "task.visibility.") {
          id
          isPrivate
          interceptorCount
          hasInterceptors
          interceptorOwnerIds
        }
        resources(idIncludes: "res.visibility.module") {
          id
          isolation {
            deny
            only
            exports
            exportsMode
          }
          isPrivate
        }
        interceptorOwners {
          tasksById {
            taskId
            ownerResourceIds
          }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    const publicTask = data.tasks.find(
      (node: any) => node.id === "task.visibility.public"
    );
    const privateTask = data.tasks.find(
      (node: any) => node.id === "task.visibility.private"
    );
    const moduleResource = data.resources.find(
      (node: any) => node.id === "res.visibility.module"
    );

    expect(publicTask).toBeTruthy();
    expect(publicTask.isPrivate).toBe(false);
    expect(publicTask.hasInterceptors).toBe(true);
    expect(publicTask.interceptorCount).toBe(1);
    expect(publicTask.interceptorOwnerIds).toEqual([
      "res.visibility.interceptor",
    ]);

    expect(privateTask).toBeTruthy();
    expect(privateTask.isPrivate).toBe(true);
    expect(privateTask.hasInterceptors).toBe(false);
    expect(privateTask.interceptorCount).toBe(0);
    expect(privateTask.interceptorOwnerIds).toEqual([]);

    expect(moduleResource).toBeTruthy();
    expect(moduleResource.isPrivate).toBe(false);
    expect(moduleResource.isolation.exports).toEqual([
      "task.visibility.public",
    ]);

    const ownersEntry = data.interceptorOwners.tasksById.find(
      (entry: any) => entry.taskId === "task.visibility.public"
    );
    expect(ownersEntry).toBeTruthy();
    expect(ownersEntry.ownerResourceIds).toEqual([
      "res.visibility.interceptor",
    ]);
  });

  test("deep traversal from middleware root -> usedByTasksResolved -> nested middlewareResolved", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-3",
      dependencies: { introspector },
      async init(_config, { introspector }) {
        ctx = {
          store: undefined,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    const query = `
      query FromMiddlewareRoot {
        middlewares {
          id
          usedByTasksResolved {
            id
            middlewareResolved { id }
          }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    const mwLog = data.middlewares.find((m: any) => m.id === "mw.log.task");
    expect(mwLog).toBeTruthy();
    const usedByTaskIds = mwLog.usedByTasksResolved.map((t: any) => t.id);
    expect(usedByTaskIds).toEqual(expect.arrayContaining(["task.hello"]));
    // Nested middlewareResolved should include mw.log again
    const nested = mwLog.usedByTasksResolved.find(
      (t: any) => t.id === "task.hello"
    );
    expect(nested.middlewareResolved.map((m: any) => m.id)).toEqual(
      expect.arrayContaining(["mw.log.task"])
    );
  });

  test("TaskInterface and HookType resolveType and isTypeOf coverage", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-4",
      dependencies: { introspector, store: globals.resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    // Query that specifically tests the TaskInterface.resolveType function
    // and ensures both Task and Hook types are properly identified
    const query = `
      query TypeResolutionTest {
        tasks {
          __typename
          id
          emits
          dependsOn
          ... on Task {
            dependsOnResolved {
              tasks { id }
              hooks { id } 
              resources { id }
              emitters { id }
            }
          }
        }
        hooks {
          __typename
          id
          event
          ... on Hook {
            hookOrder
          }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;

    // Verify TaskType.isTypeOf and TaskInterface.resolveType work correctly
    const tasks = data.tasks;
    tasks.forEach((task: any) => {
      expect(task.__typename).toBe("Task");
      expect(Array.isArray(task.emits)).toBe(true);
      expect(Array.isArray(task.dependsOn)).toBe(true);
      expect(task.event).toBeUndefined(); // Tasks should not have 'event' field
    });

    // Verify HookType.isTypeOf and TaskInterface.resolveType work correctly
    const hooks = data.hooks;
    hooks.forEach((hook: any) => {
      expect(hook.__typename).toBe("Hook");
      expect(typeof hook.event).toBe("string");
    });
  });

  test("TaskInterface field resolvers coverage", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-5",
      dependencies: { introspector, store: globals.resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    // Simple query to ensure field resolvers are called
    const query = `
      query SimpleFieldResolvers {
        tasks {
          id
          filePath
          markdownDescription
          meta {
            title
            description
          }
        }
        hooks {
          id
          filePath
          markdownDescription
          meta {
            title
            description
          }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();
    expect(result.data?.tasks).toBeDefined();
    expect(result.data?.hooks).toBeDefined();
  });

  test("idIncludes filtering works across queries", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-6",
      dependencies: { introspector, store: globals.resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    // Add an explicit orphan event to check event idIncludes filter
    const orphanEvt = event({ id: "evt.readme.orphan" });
    const app = createDummyApp([introspector, orphanEvt, probe]);
    await run(app);

    const query = `
      query Filtering {
        all(idIncludes: "hello") { id __typename }
        tasksHello: tasks(idIncludes: "hello") { id }
        hooksHello: hooks(idIncludes: "hello") { id }
        resourcesRes: resources(idIncludes: "res.") { id }
        middlewaresMw: middlewares(idIncludes: "mw.") { id }
        eventsReadme: events(filter: { idIncludes: "readme." }) { id }
        eventsHello: events(filter: { idIncludes: "hello" }) { id }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    const allIds = data.all.map((n: any) => n.id);
    expect(allIds).toEqual(
      expect.arrayContaining(["task.hello", "hook.hello", "evt.hello"])
    );

    expect(data.tasksHello.map((t: any) => t.id)).toEqual(
      expect.arrayContaining(["task.hello"])
    );
    expect(data.hooksHello.map((l: any) => l.id)).toEqual(
      expect.arrayContaining(["hook.hello"])
    );
    expect(data.resourcesRes.map((r: any) => r.id)).toEqual(
      expect.arrayContaining(["res.db", "res.cache"])
    );
    expect(data.middlewaresMw.map((m: any) => m.id)).toEqual(
      expect.arrayContaining(["mw.log", "mw.log.task", "mw.tag"])
    );
    expect(data.eventsReadme.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.readme.orphan"])
    );
    expect(data.eventsHello.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );
  });
});
