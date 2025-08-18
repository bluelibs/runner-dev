import { resource, run, globals } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp } from "../dummy/dummyApp";
import { event } from "@bluelibs/runner";
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
        tasks {
          id
          filePath
          fileContents
          fileContentsSliced: fileContents(startLine: 1, endLine: 5)
          markdownDescription
          inputSchema
          inputSchemaReadable
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
          middleware
          middlewareResolved { id }
          overrides
          overridesResolved { id }
          registers
          registersResolved { id }
          usedBy { id }
          emits { id }
          configSchema
          configSchemaReadable
        }
        events { 
          id
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
    expect(helloTask.emits).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(helloTask.emitsResolved.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );

    const evt = data.events.find((e: any) => e.id === "evt.hello");
    expect(evt.listenedToBy).toEqual(expect.arrayContaining(["hook.hello"]));
    expect(evt.listenedToByResolved.map((l: any) => l.id)).toEqual(
      expect.arrayContaining(["hook.hello"])
    );

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
    expect(typeof cache.configSchema).toBe("string");
    expect(cache.configSchema).toBeTruthy();
    expect(String(cache.configSchema)).toContain("ttlMs");
    expect(typeof cache.configSchemaReadable === "string").toBe(true);
    expect(cache.configSchemaReadable).toContain("ttlMs");

    // Filtered events
    const withHooks: string[] = data.eventsWithHooks.map((e: any) => e.id);
    const withoutHooks: string[] = data.eventsWithoutHooks.map(
      (e: any) => e.id
    );
    expect(withHooks).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(withoutHooks).toEqual(expect.arrayContaining(["evt.readme.orphan"]));
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
            usedByTasksResolved { id }
            usedByResourcesResolved { id }
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
      (m: any) => m.id === "mw.log"
    );
    expect(mwLog).toBeTruthy();
    // mw.log is used by task.hello and resource res.db
    expect(mwLog.usedByTasksResolved.map((t: any) => t.id)).toEqual(
      expect.arrayContaining(["task.hello"])
    );
    expect(mwLog.usedByResourcesResolved.map((r: any) => r.id)).toEqual(
      expect.arrayContaining(["res.db"])
    );
    expect(mwLog.emits.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );
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
    const mwLog = data.middlewares.find((m: any) => m.id === "mw.log");
    expect(mwLog).toBeTruthy();
    const usedByTaskIds = mwLog.usedByTasksResolved.map((t: any) => t.id);
    expect(usedByTaskIds).toEqual(expect.arrayContaining(["task.hello"]));
    // Nested middlewareResolved should include mw.log again
    const nested = mwLog.usedByTasksResolved.find(
      (t: any) => t.id === "task.hello"
    );
    expect(nested.middlewareResolved.map((m: any) => m.id)).toEqual(
      expect.arrayContaining(["mw.log"])
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
      expect.arrayContaining(["mw.log", "mw.tag"])
    );
    expect(data.eventsReadme.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.readme.orphan"])
    );
    expect(data.eventsHello.map((e: any) => e.id)).toEqual(
      expect.arrayContaining(["evt.hello"])
    );
  });
});
