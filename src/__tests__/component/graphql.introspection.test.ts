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
          emits
          emitsResolved { id }
          dependsOn
          middleware
          middlewareResolved { id }
          dependsOnResolved {
            tasks { id }
            listeners { id }
            resources { id }
            emitters { id }
          }
        }
        listeners {
          id
          event
          emits
          emitsResolved { id }
          dependsOn
          middleware
          middlewareResolved { id }
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
        }
        events { 
          id
          emittedBy
          emittedByResolved { id }
          listenedToBy
          listenedToByResolved { id }
        }
        eventsWithListeners: events(filter: { hasNoListeners: false }) { id }
        eventsWithoutListeners: events(filter: { hasNoListeners: true }) { id }
        middlewares {
          id
          usedByTasks
          usedByTasksResolved { id }
          usedByTasksDetailed { id config node { id } }
          usedByResources
          usedByResourcesResolved { id }
          usedByResourcesDetailed { id config node { id } }
          emits { id }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });

    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    expect(Array.isArray(data?.tasks)).toBe(true);
    expect(Array.isArray(data.listeners)).toBe(true);
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
    expect(evt.listenedToBy).toEqual(
      expect.arrayContaining(["listener.hello"])
    );
    expect(evt.listenedToByResolved.map((l: any) => l.id)).toEqual(
      expect.arrayContaining(["listener.hello"])
    );

    const mwLog = data.middlewares.find((m: any) => m.id === "mw.log");
    expect(mwLog.usedByResources).toEqual(expect.arrayContaining(["res.db"]));

    // Filtered events
    const withListeners: string[] = data.eventsWithListeners.map(
      (e: any) => e.id
    );
    const withoutListeners: string[] = data.eventsWithoutListeners.map(
      (e: any) => e.id
    );
    expect(withListeners).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(withoutListeners).toEqual(
      expect.arrayContaining(["evt.readme.orphan"])
    );
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
});
