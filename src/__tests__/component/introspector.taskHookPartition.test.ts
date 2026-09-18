import { graphql as executeGraphql } from "graphql";
import { schema } from "../../schema";
import { Introspector } from "../../resources/models/Introspector";

/**
 * Crafted snapshot proving tasks and hooks stay partitioned where the
 * GraphQL schema promises one kind or the other.
 */
function buildIntrospector(): Introspector {
  return Introspector.deserialize({
    tasks: [
      {
        id: "t1",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        dependsOn: ["h1", "r1"],
        emits: ["e1"],
        middleware: ["m1"],
        middlewareDetailed: [],
      },
    ],
    hooks: [
      {
        id: "h1",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        events: ["e1"],
        dependsOn: ["r1"],
        emits: [],
        middleware: ["m1"],
        middlewareDetailed: [],
      },
    ],
    resources: [
      {
        id: "r1",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        dependsOn: [],
        emits: ["e1"],
        middleware: ["m2"],
        middlewareDetailed: [],
        overrides: [],
        registers: [],
      },
    ],
    events: [
      {
        id: "e1",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        listenedToBy: ["h1"],
        transactional: false,
        parallel: false,
      },
    ],
    middlewares: [
      {
        id: "m1",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        type: "task",
        autoApply: { enabled: false, scope: null, hasPredicate: false },
        usedByTasks: ["t1"],
        usedByResources: [],
      },
      {
        id: "m2",
        meta: null,
        filePath: null,
        isPrivate: false,
        visibilityReason: null,
        tags: [],
        type: "resource",
        autoApply: { enabled: false, scope: null, hasPredicate: false },
        usedByTasks: [],
        usedByResources: ["r1"],
      },
    ],
    tags: [],
    errors: [],
    asyncContexts: [],
  } as any);
}

describe("task/hook partitioning", () => {
  test("dependsOnResolved keeps hooks out of the tasks bucket", async () => {
    const introspector = buildIntrospector();
    const result = await executeGraphql({
      schema,
      source: `query {
        task(id: "t1") {
          dependsOnResolved {
            tasks { id }
            hooks { id }
            resources { id }
            emitters { id }
          }
        }
      }`,
      contextValue: { introspector },
    });

    expect(result.errors).toBeUndefined();
    const resolved = (result.data as any)?.task?.dependsOnResolved;
    expect(resolved.hooks.map((h: any) => h.id)).toEqual(["h1"]);
    expect(resolved.tasks.map((t: any) => t.id)).toEqual([]);
    expect(resolved.resources.map((r: any) => r.id)).toEqual(["r1"]);
    expect(resolved.emitters.map((e: any) => e.id)).toEqual(["e1"]);
  });

  test("resource usedBy only serves tasks", async () => {
    const introspector = buildIntrospector();
    const result = await executeGraphql({
      schema,
      source: `query { resource(id: "r1") { usedBy { id } } }`,
      contextValue: { introspector },
    });

    expect(result.errors).toBeUndefined();
    expect(
      (result.data as any)?.resource?.usedBy.map((t: any) => t.id)
    ).toEqual(["t1"]);
  });

  test("task middleware usedBy only serves tasks", async () => {
    const introspector = buildIntrospector();
    const result = await executeGraphql({
      schema,
      source: `query {
        taskMiddlewares { id usedBy { id } }
        middlewares { id usedByTasksResolved { id } }
      }`,
      contextValue: { introspector },
    });

    expect(result.errors).toBeUndefined();
    const taskMw = (result.data as any)?.taskMiddlewares.find(
      (m: any) => m.id === "m1"
    );
    expect(taskMw.usedBy.map((t: any) => t.id)).toEqual(["t1"]);
    const legacy = (result.data as any)?.middlewares.find(
      (m: any) => m.id === "m1"
    );
    expect(legacy.usedByTasksResolved.map((t: any) => t.id)).toEqual(["t1"]);
  });

  test("resource middleware emits resolve through using resources", () => {
    const introspector = buildIntrospector();
    expect(
      introspector.getMiddlewareEmittedEvents("m2").map((e) => e.id)
    ).toEqual(["e1"]);
    expect(
      introspector.getMiddlewareEmittedEvents("m1").map((e) => e.id)
    ).toEqual(["e1"]);
  });

  test("hook middleware detailed usages resolve empty", async () => {
    const introspector = buildIntrospector();
    const result = await executeGraphql({
      schema,
      source: `query {
        hook(id: "h1") { middlewareResolvedDetailed { id } }
      }`,
      contextValue: { introspector },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data as any)?.hook?.middlewareResolvedDetailed).toEqual([]);
  });
});
