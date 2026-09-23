import { graphql as executeGraphql } from "graphql";
import { defineResource, run } from "@bluelibs/runner";
import { schema } from "../../schema";
import type { Event, Hook, Middleware, Resource, Task } from "../../schema";
import { introspector as introspectorResource } from "../../resources/introspector.resource";
import { Introspector } from "../../resources/models/Introspector";
import {
  createDummyApp,
  dummyAppIds,
  evtHello,
  logMw,
  logMwTask,
} from "../dummy/dummyApp";

function event(id: string): Event {
  return { id, listenedToBy: [], transactional: false, parallel: false };
}

function middleware(id: string, type: Middleware["type"]): Middleware {
  return {
    id,
    type,
    autoApply: { enabled: false, scope: null, hasPredicate: false },
    usedByTasks: [],
    usedByResources: [],
  };
}

/** A task that depends on the db resource and emits its own event. */
function dbConsumerTask(id: string, emits: string[]): Task {
  return { id, emits, dependsOn: ["db"], middleware: ["audit"] };
}

/**
 * The `retry` resource middleware wraps `db`; three tasks and a hook depend
 * on `db` and emit their own events. Those consumers run outside the
 * resource middleware, so their events must not surface on it.
 */
function buildIntrospector(): Introspector {
  const db: Resource = {
    id: "db",
    emits: ["db.connected"],
    dependsOn: [],
    middleware: ["retry"],
    overrides: [],
    registers: [],
  };
  const consumerHook: Hook = {
    id: "audit-hook",
    events: ["order.placed"],
    dependsOn: ["db"],
    emits: ["audit.logged"],
  };

  return Introspector.deserialize({
    tasks: [
      dbConsumerTask("place-order", ["order.placed"]),
      dbConsumerTask("cancel-order", ["order.cancelled"]),
      dbConsumerTask("ship-order", ["order.shipped"]),
    ],
    hooks: [consumerHook],
    resources: [db],
    events: [
      "db.connected",
      "order.placed",
      "order.cancelled",
      "order.shipped",
      "audit.logged",
    ].map(event),
    middlewares: [middleware("retry", "resource"), middleware("audit", "task")],
    tags: [],
  });
}

function eventIds(events: Event[]): string[] {
  return events.map((entry) => entry.id).sort();
}

describe("middleware emitted events", () => {
  test("resource middleware only reports events of the resources it wraps", () => {
    const introspector = buildIntrospector();

    expect(eventIds(introspector.getMiddlewareEmittedEvents("retry"))).toEqual([
      "db.connected",
    ]);
  });

  test("task middleware keeps reporting events of the tasks it wraps", () => {
    const introspector = buildIntrospector();

    expect(eventIds(introspector.getMiddlewareEmittedEvents("audit"))).toEqual([
      "order.cancelled",
      "order.placed",
      "order.shipped",
    ]);
  });

  test("GraphQL emits for resource middleware excludes resource consumers", async () => {
    const result = await executeGraphql({
      schema,
      source: `query {
        resourceMiddlewares { id emits { id } }
        middlewares { id emits { id } }
      }`,
      contextValue: { introspector: buildIntrospector() },
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as {
      resourceMiddlewares: Array<{ id: string; emits: Array<{ id: string }> }>;
      middlewares: Array<{ id: string; emits: Array<{ id: string }> }>;
    };
    const retry = data.resourceMiddlewares.find(
      (entry) => entry.id === "retry"
    );
    const legacyRetry = data.middlewares.find((entry) => entry.id === "retry");
    expect(retry?.emits).toEqual([{ id: "db.connected" }]);
    expect(legacyRetry?.emits).toEqual([{ id: "db.connected" }]);
  });

  test("a live app does not leak dependent task events into resource middleware", async () => {
    let resourceMiddlewareEmits: string[] = [];
    let taskMiddlewareEmits: string[] = [];
    const probe = defineResource({
      id: "probe-middleware-emits",
      dependencies: { introspector: introspectorResource },
      async init(_config, { introspector }) {
        resourceMiddlewareEmits = eventIds(
          introspector.getMiddlewareEmittedEvents(
            dummyAppIds.resourceMiddleware(logMw.id)
          )
        );
        taskMiddlewareEmits = eventIds(
          introspector.getMiddlewareEmittedEvents(
            dummyAppIds.taskMiddleware(logMwTask.id)
          )
        );
      },
    });

    const runtime = await run(createDummyApp([introspectorResource, probe]));
    try {
      // task-hello depends on res-db (wrapped by mw-log) and emits
      // evt-hello; res-db itself declares no event dependencies.
      expect(resourceMiddlewareEmits).toEqual([]);
      expect(taskMiddlewareEmits).toEqual([dummyAppIds.event(evtHello.id)]);
    } finally {
      await runtime.dispose();
    }
  });
});
