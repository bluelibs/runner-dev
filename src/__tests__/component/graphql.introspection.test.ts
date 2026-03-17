import {
  defineResource,
  run,
  resources,
  defineEvent,
  defineTask,
} from "@bluelibs/runner";
import { schema } from "../../schema";
import {
  createDummyApp,
  dummyAppIds,
  evtHello,
  helloTask,
  logMw,
  logMwTask,
  tagMw,
} from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";
import { Introspector } from "../../resources/models/Introspector";

const visibilityAppIds = {
  resource(localId: string) {
    return `app-graphql-visibility.${localId}`;
  },
  task(localId: string) {
    return `app-graphql-visibility.res-visibility-module.tasks.${localId}`;
  },
};

/**
 * This test executes a deep GraphQL query against the built schema
 * using the same GraphQLContext shape the server would provide.
 */
describe("GraphQL schema (integration)", () => {
  test("deep query returns rich graph", async () => {
    let ctx: any;

    const probe = defineResource({
      id: "probe-graphql-1",
      dependencies: { introspector, store: resources.store },
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
    const orphanEvt = defineEvent({ id: "evt-readme-orphan" });
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
          dispose {
            totalBudgetMs
            drainingBudgetMs
            cooldownWindowMs
          }
          executionContext {
            enabled
            cycleDetection
          }
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
          rpcLane { laneId }
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
          rpcLane { laneId }
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
    const helloTaskNode = data.tasks.find(
      (t: any) => t.id === dummyAppIds.task(helloTask.id)
    );
    expect(typeof helloTaskNode.isPrivate).toBe("boolean");
    expect(typeof helloTaskNode.interceptorCount).toBe("number");
    expect(typeof helloTaskNode.hasInterceptors).toBe("boolean");
    expect(Array.isArray(helloTaskNode.interceptorOwnerIds)).toBe(true);
    expect(helloTaskNode.emits).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
    expect("rpcLane" in helloTaskNode).toBe(true);
    expect(helloTaskNode.emitsResolved.map((e: any) => e.id)).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );

    const evt = data.events.find(
      (e: any) => e.id === dummyAppIds.event(evtHello.id)
    );
    expect(Array.isArray(evt.listenedToBy)).toBe(true);
    expect("rpcLane" in evt).toBe(true);

    expect(typeof evt.payloadSchema).toBe("string");
    expect(evt.payloadSchema).toBeTruthy();
    expect(String(evt.payloadSchema)).toContain("name");
    expect(typeof evt.payloadSchemaReadable === "string").toBe(true);
    expect(evt.payloadSchemaReadable).toContain("name");
    // Schemas present and look like JSON
    expect(typeof evt.payloadSchema === "string").toBe(true);

    const mwLogNode = data.middlewares.find(
      (m: any) => m.id === dummyAppIds.resourceMiddleware(logMw.id)
    );
    expect(mwLogNode.usedByResources).toEqual(
      expect.arrayContaining([dummyAppIds.resource("res-db")])
    );
    // Resource config markdown exists for cacheRes
    const cache = data.resources.find(
      (r: any) => r.id === dummyAppIds.resource("res-cache")
    );
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
    expect(withHooks).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
    expect(withoutHooks).toEqual(
      expect.arrayContaining([dummyAppIds.event("evt-readme-orphan")])
    );

    // Explicitly-declared event should have a filePath (comes from store symbol)
    expect(typeof evt.filePath === "string").toBe(true);
    expect(typeof evt.isPrivate).toBe("boolean");
    expect(evt.filePath).toBeTruthy();

    expect(typeof mwLogNode.isPrivate).toBe("boolean");

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
    expect(data.runOptions.dispose).toBeDefined();
    expect(
      data.runOptions.dispose.totalBudgetMs === null ||
        typeof data.runOptions.dispose.totalBudgetMs === "number"
    ).toBe(true);
    expect(
      data.runOptions.dispose.drainingBudgetMs === null ||
        typeof data.runOptions.dispose.drainingBudgetMs === "number"
    ).toBe(true);
    expect(
      data.runOptions.dispose.cooldownWindowMs === null ||
        typeof data.runOptions.dispose.cooldownWindowMs === "number"
    ).toBe(true);
    expect(data.runOptions.executionContext).toBeDefined();
    expect(typeof data.runOptions.executionContext.enabled).toBe("boolean");
    expect(
      data.runOptions.executionContext.cycleDetection === null ||
        typeof data.runOptions.executionContext.cycleDetection === "boolean"
    ).toBe(true);
    expect(typeof data.runOptions.hasOnUnhandledError).toBe("boolean");
    expect(typeof data.runOptions.rootId).toBe("string");
    expect(data.runOptions.rootId).toBeTruthy();
    expect(data.interceptorOwners).toBeDefined();
    expect(Array.isArray(data.interceptorOwners.tasksById)).toBe(true);
    expect(data.interceptorOwners.middleware).toBeDefined();
  });

  test("removes Resource.tunnelInfo and exposes rpcLane on Task/Event", async () => {
    let ctx: any;

    const probe = defineResource({
      id: "probe-graphql-lanes-schema",
      dependencies: { introspector, store: resources.store },
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

    const schemaQuery = `
      query SchemaLanes {
        resourceType: __type(name: "Resource") {
          fields { name }
        }
        taskType: __type(name: "Task") {
          fields { name type { kind name ofType { kind name } } }
        }
        eventType: __type(name: "Event") {
          fields { name type { kind name ofType { kind name } } }
        }
      }
    `;

    const result = await graphql({
      schema,
      source: schemaQuery,
      contextValue: ctx,
    });

    expect(result.errors).toBeUndefined();
    const data: any = result.data;

    const resourceFields = data.resourceType.fields.map((f: any) => f.name);
    expect(resourceFields).not.toContain("tunnelInfo");

    const taskRpcLaneField = data.taskType.fields.find(
      (field: any) => field.name === "rpcLane"
    );
    const eventRpcLaneField = data.eventType.fields.find(
      (field: any) => field.name === "rpcLane"
    );
    expect(taskRpcLaneField).toBeTruthy();
    expect(eventRpcLaneField).toBeTruthy();

    const taskRpcLaneTypeName =
      taskRpcLaneField.type.name ?? taskRpcLaneField.type.ofType?.name;
    const eventRpcLaneTypeName =
      eventRpcLaneField.type.name ?? eventRpcLaneField.type.ofType?.name;
    expect(taskRpcLaneTypeName).toBe("RpcLaneSummary");
    expect(eventRpcLaneTypeName).toBe("RpcLaneSummary");
  });

  test("deep traversal from task -> middlewareResolved -> dependents", async () => {
    let ctx: any;

    const probe = defineResource({
      id: "probe-graphql-2",
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
    const helloTaskNode = data.tasks.find(
      (t: any) => t.id === dummyAppIds.task(helloTask.id)
    );
    expect(helloTaskNode).toBeTruthy();
    const mwLogNode = helloTaskNode.middlewareResolved.find(
      (m: any) => m.id === dummyAppIds.taskMiddleware(logMwTask.id)
    );
    expect(mwLogNode).toBeTruthy();
    // mw.log is used by task.hello and resource res.db
    expect(mwLogNode.usedBy.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([dummyAppIds.task(helloTask.id)])
    );
    expect(mwLogNode.emits.map((e: any) => e.id)).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
  });

  test("surfaces isolate()-based privacy and task interceptors", async () => {
    let ctx: any;

    const visibilityPublicTask = defineTask({
      id: "task-visibility-public",
      run: async (input: { value: number }) => ({ value: input.value }),
    });

    const visibilityPrivateTask = defineTask({
      id: "task-visibility-private",
      run: async (input: { value: number }) => ({ value: input.value }),
    });

    const visibilityModule = defineResource({
      id: "res-visibility-module",
      register: [visibilityPublicTask, visibilityPrivateTask],
      isolate: { exports: [visibilityPublicTask] },
    });

    const interceptorInstaller = defineResource({
      id: "res-visibility-interceptor",
      dependencies: { visibilityPublicTask },
      async init(_config, deps) {
        deps.visibilityPublicTask.intercept(async (next, input) =>
          next({ value: input.value + 1 })
        );
      },
    });

    const probe = defineResource({
      id: "probe-graphql-visibility",
      dependencies: { introspector, store: resources.store },
      async init(_config, { introspector, store }) {
        ctx = {
          store,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = defineResource({
      id: "app-graphql-visibility",
      register: [introspector, visibilityModule, interceptorInstaller, probe],
    });

    await run(app);

    const query = `
      query VisibilityAndInterceptors {
        tasks(idIncludes: "task-visibility-") {
          id
          isPrivate
          interceptorCount
          hasInterceptors
          interceptorOwnerIds
        }
        resources(idIncludes: "res-visibility-module") {
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
      (node: any) => node.id === visibilityAppIds.task("task-visibility-public")
    );
    const privateTask = data.tasks.find(
      (node: any) =>
        node.id === visibilityAppIds.task("task-visibility-private")
    );
    const moduleResource = data.resources.find(
      (node: any) =>
        node.id === visibilityAppIds.resource("res-visibility-module")
    );

    expect(publicTask).toBeTruthy();
    expect(publicTask.isPrivate).toBe(false);
    expect(publicTask.hasInterceptors).toBe(true);
    expect(publicTask.interceptorCount).toBe(1);
    expect(publicTask.interceptorOwnerIds).toEqual([
      visibilityAppIds.resource("res-visibility-interceptor"),
    ]);

    expect(privateTask).toBeTruthy();
    expect(privateTask.isPrivate).toBe(true);
    expect(privateTask.hasInterceptors).toBe(false);
    expect(privateTask.interceptorCount).toBe(0);
    expect(privateTask.interceptorOwnerIds).toEqual([]);

    expect(moduleResource).toBeTruthy();
    expect(moduleResource.isPrivate).toBe(false);
    expect(moduleResource.isolation.exports).toEqual([
      visibilityAppIds.task("task-visibility-public"),
    ]);

    const ownersEntry = data.interceptorOwners.tasksById.find(
      (entry: any) =>
        entry.taskId === visibilityAppIds.task("task-visibility-public")
    );
    expect(ownersEntry).toBeTruthy();
    expect(ownersEntry.ownerResourceIds).toEqual([
      visibilityAppIds.resource("res-visibility-interceptor"),
    ]);
  });

  test("deep traversal from middleware root -> usedByTasksResolved -> nested middlewareResolved", async () => {
    let ctx: any;

    const probe = defineResource({
      id: "probe-graphql-3",
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
    const mwLogNode = data.middlewares.find(
      (m: any) => m.id === dummyAppIds.taskMiddleware(logMwTask.id)
    );
    expect(mwLogNode).toBeTruthy();
    const usedByTaskIds = mwLogNode.usedByTasksResolved.map((t: any) => t.id);
    expect(usedByTaskIds).toEqual(
      expect.arrayContaining([dummyAppIds.task(helloTask.id)])
    );
    // Nested middlewareResolved should include mw.log again
    const nested = mwLogNode.usedByTasksResolved.find(
      (t: any) => t.id === dummyAppIds.task(helloTask.id)
    );
    expect(nested.middlewareResolved.map((m: any) => m.id)).toEqual(
      expect.arrayContaining([dummyAppIds.taskMiddleware(logMwTask.id)])
    );
  });

  test("TaskInterface and HookType resolveType and isTypeOf coverage", async () => {
    let ctx: any;

    const probe = defineResource({
      id: "probe-graphql-4",
      dependencies: { introspector, store: resources.store },
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

    const probe = defineResource({
      id: "probe-graphql-5",
      dependencies: { introspector, store: resources.store },
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

    const probe = defineResource({
      id: "probe-graphql-6",
      dependencies: { introspector, store: resources.store },
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
    const orphanEvt = defineEvent({ id: "evt-readme-orphan" });
    const app = createDummyApp([introspector, orphanEvt, probe]);
    await run(app);

    const query = `
      query Filtering {
        all(idIncludes: "hello") { id __typename }
        tasksHello: tasks(idIncludes: "hello") { id }
        hooksHello: hooks(idIncludes: "hello") { id }
        resourcesRes: resources(idIncludes: "res-") { id }
        middlewaresMw: middlewares(idIncludes: "mw-") { id }
        eventsReadme: events(filter: { idIncludes: "readme-" }) { id }
        eventsHello: events(filter: { idIncludes: "hello" }) { id }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    const allIds = data.all.map((n: any) => n.id);
    expect(allIds).toEqual(
      expect.arrayContaining([
        dummyAppIds.task(helloTask.id),
        dummyAppIds.hook("hook-hello"),
        dummyAppIds.event(evtHello.id),
      ])
    );

    expect(data.tasksHello.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([dummyAppIds.task(helloTask.id)])
    );
    expect(data.hooksHello.map((l: any) => l.id)).toEqual(
      expect.arrayContaining([dummyAppIds.hook("hook-hello")])
    );
    expect(data.resourcesRes.map((r: any) => r.id)).toEqual(
      expect.arrayContaining([
        dummyAppIds.resource("res-db"),
        dummyAppIds.resource("res-cache"),
      ])
    );
    expect(data.middlewaresMw.map((m: any) => m.id)).toEqual(
      expect.arrayContaining([
        dummyAppIds.resourceMiddleware(logMw.id),
        dummyAppIds.taskMiddleware(logMwTask.id),
        dummyAppIds.taskMiddleware(tagMw.id),
      ])
    );
    expect(data.eventsReadme.map((e: any) => e.id)).toEqual(
      expect.arrayContaining([dummyAppIds.event("evt-readme-orphan")])
    );
    expect(data.eventsHello.map((e: any) => e.id)).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
  });

  test("hideSystem hides only system namespace events", async () => {
    const ctx = {
      store: null,
      logger: console,
      introspector: new Introspector({
        data: {
          tasks: [],
          hooks: [],
          resources: [],
          middlewares: [],
          tags: [],
          errors: [],
          asyncContexts: [],
          events: [
            {
              id: "system.events.ready",
              listenedToBy: [],
              transactional: false,
              parallel: false,
            },
            {
              id: "system.events.custom",
              listenedToBy: [],
              transactional: false,
              parallel: false,
            },
            {
              id: "runner.events.visible",
              listenedToBy: [],
              transactional: false,
              parallel: false,
            },
            {
              id: "app.events.visible",
              listenedToBy: [],
              transactional: false,
              parallel: false,
            },
          ],
        },
      }),
      live: { logs: [] },
    };

    const query = `
      query HideSystemEvents {
        visibleEvents: events(filter: { hideSystem: true }) { id }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const eventIds = (
      (result.data?.visibleEvents ?? []) as Array<{ id: string }>
    ).map((e) => e.id);

    expect(eventIds).not.toContain("system.events.ready");
    expect(eventIds).not.toContain("system.events.custom");
    expect(eventIds).toContain("runner.events.visible");
    expect(eventIds).toContain("app.events.visible");
  });
});
