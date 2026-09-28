import { graphql as executeGraphql } from "graphql";
import { defineResourceMiddleware, r, run } from "@bluelibs/runner";
import { schema } from "../../schema";
import type { Middleware, Resource } from "../../schema";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";
import {
  mapStoreResourceToResourceModel,
  mapStoreTaskToTaskModel,
} from "../../resources/models/initializeFromStore.utils";

type UsageRow = {
  id: string;
  origin: string | null;
  subtreeOwnerId: string | null;
};

const subtreeMiddleware = defineResourceMiddleware({
  id: "test-subtree-resource-audit",
  async run({ next }) {
    return next();
  },
});
const localMiddleware = defineResourceMiddleware({
  id: "test-subtree-resource-local",
  async run({ next }) {
    return next();
  },
});
const childResource = r
  .resource("test-subtree-resource-child")
  .middleware([localMiddleware])
  .init(async () => "child")
  .build();
const moduleResource = r
  .resource("test-subtree-resource-module")
  .subtree({ resources: { middleware: [subtreeMiddleware] } })
  .register([subtreeMiddleware, localMiddleware, childResource])
  .init(async () => "module")
  .build();
const app = r
  .resource("test-subtree-resource-app")
  .register([moduleResource])
  .build();

async function withIntrospector(
  assertions: (introspector: Introspector, ids: Record<string, string>) => void
): Promise<void> {
  const runtime = await run(app);
  try {
    const introspector = new Introspector({ store: runtime.store });
    initializeFromStore(introspector, runtime.store);
    const idOf = (definition: { id: string }) =>
      runtime.store.findIdByDefinition(definition);
    assertions(introspector, {
      module: idOf(moduleResource),
      child: idOf(childResource),
      subtreeMiddleware: idOf(subtreeMiddleware),
      localMiddleware: idOf(localMiddleware),
    });
  } finally {
    await runtime.dispose();
  }
}

function pickUsage(rows: UsageRow[]): UsageRow[] {
  return rows.map(({ id, origin, subtreeOwnerId }) => ({
    id,
    origin,
    subtreeOwnerId,
  }));
}

describe("resource middleware subtree provenance", () => {
  test("marks subtree-applied resource middleware with its owner", async () => {
    await withIntrospector((introspector, ids) => {
      const child = introspector.getResource(ids.child);
      const owner = introspector.getResource(ids.module);

      expect(
        pickUsage(introspector.getMiddlewareUsagesForResource(ids.child))
      ).toEqual([
        {
          id: ids.subtreeMiddleware,
          origin: "subtree",
          subtreeOwnerId: ids.module,
        },
        { id: ids.localMiddleware, origin: "local", subtreeOwnerId: null },
      ]);
      expect(child?.middleware).toEqual([
        ids.subtreeMiddleware,
        ids.localMiddleware,
      ]);
      // Runner applies an owner's subtree resource middleware to the owner
      // itself, so provenance points back at the owner.
      expect(owner?.middlewareDetailed).toEqual([
        {
          id: ids.subtreeMiddleware,
          config: "{}",
          origin: "subtree",
          subtreeOwnerId: ids.module,
        },
      ]);
    });
  });

  test("lists the origin on the middleware side as well", async () => {
    await withIntrospector((introspector, ids) => {
      expect(
        pickUsage(
          introspector.getResourcesUsingMiddlewareDetailed(
            ids.subtreeMiddleware
          )
        )
      ).toEqual([
        { id: ids.module, origin: "subtree", subtreeOwnerId: ids.module },
        { id: ids.child, origin: "subtree", subtreeOwnerId: ids.module },
      ]);
      expect(
        pickUsage(
          introspector.getResourcesUsingMiddlewareDetailed(ids.localMiddleware)
        )
      ).toEqual([{ id: ids.child, origin: "local", subtreeOwnerId: null }]);
    });
  });

  test("exposes origin fields through GraphQL, also after a snapshot round-trip", async () => {
    let live: Introspector | null = null;
    let ids: Record<string, string> = {};
    await withIntrospector((introspector, resolvedIds) => {
      live = introspector;
      ids = resolvedIds;
    });
    if (!live) throw new Error("introspector was not initialized");
    const snapshot = Introspector.deserialize(
      JSON.parse(JSON.stringify((live as Introspector).serialize()))
    );

    for (const introspector of [live, snapshot]) {
      const result = await executeGraphql({
        schema,
        source: `query ($childId: ID!, $middlewareId: ID!) {
          resource(id: $childId) {
            middlewareResolvedDetailed { id origin subtreeOwnerId }
          }
          middleware(id: $middlewareId) {
            usedByResourcesDetailed { id origin subtreeOwnerId }
          }
          resourceMiddlewares {
            id
            usedByDetailed { id origin subtreeOwnerId }
          }
        }`,
        variableValues: {
          childId: ids.child,
          middlewareId: ids.subtreeMiddleware,
        },
        contextValue: { introspector },
      });

      expect(result.errors).toBeUndefined();
      const data = result.data as {
        resource: { middlewareResolvedDetailed: UsageRow[] };
        middleware: { usedByResourcesDetailed: UsageRow[] };
        resourceMiddlewares: Array<{ id: string; usedByDetailed: UsageRow[] }>;
      };
      expect(data.resource.middlewareResolvedDetailed).toEqual([
        {
          id: ids.subtreeMiddleware,
          origin: "subtree",
          subtreeOwnerId: ids.module,
        },
        { id: ids.localMiddleware, origin: "local", subtreeOwnerId: null },
      ]);
      const expectedSubtreeUsages = [
        { id: ids.module, origin: "subtree", subtreeOwnerId: ids.module },
        { id: ids.child, origin: "subtree", subtreeOwnerId: ids.module },
      ];
      expect(data.middleware.usedByResourcesDetailed).toEqual(
        expectedSubtreeUsages
      );
      const subtreeUsages = data.resourceMiddlewares.find(
        (entry) => entry.id === ids.subtreeMiddleware
      )?.usedByDetailed;
      expect(subtreeUsages).toEqual(expectedSubtreeUsages);
    }
  });

  test("tracks provenance for string subtree refs and conditional entries", () => {
    const ownerId = "test-subtree-resource-string-owner";
    const resourceId = `${ownerId}.child`;
    const subtreeMiddlewareId = `${ownerId}.middleware.resource.audit`;
    const gatedMiddlewareId = `${ownerId}.middleware.resource.gated`;
    const unconditionalMiddlewareId = `${ownerId}.middleware.resource.always`;
    const skippedMiddlewareId = `${ownerId}.middleware.resource.skipped`;
    const localMiddlewareId = `${ownerId}.middleware.resource.local`;
    const ownerDefinition = {
      id: ownerId,
      register: [],
      overrides: [],
      middleware: [],
      subtree: [
        {
          resources: {
            middleware: [
              "audit",
              { use: { id: "gated" }, when: () => true },
              { use: "always" },
              { use: { id: "skipped" }, when: () => false },
              {
                use: { id: "broken" },
                when: () => {
                  throw new Error("predicate failure");
                },
              },
              { notAMiddleware: true },
              42,
            ],
          },
        },
        // A second policy repeating an entry keeps the first owner.
        { resources: { middleware: ["audit"] } },
      ],
    };

    const mapped = mapStoreResourceToResourceModel(
      {
        id: resourceId,
        register: [],
        overrides: [],
        middleware: [{ id: localMiddlewareId, config: {} }],
      } as any,
      undefined,
      {
        mode: "dev",
        getOwnerResourceId: (id: string) =>
          id === resourceId ? ownerId : undefined,
        resources: new Map([[ownerId, { resource: ownerDefinition }]]),
        getMiddlewareManager: () => ({
          middlewareResolver: {
            getApplicableResourceMiddlewares: () => [
              { id: subtreeMiddlewareId, config: {} },
              { id: gatedMiddlewareId },
              { id: unconditionalMiddlewareId },
              { id: skippedMiddlewareId },
              { id: localMiddlewareId, config: {} },
            ],
          },
        }),
      } as any
    );

    expect(mapped.middleware).toEqual([
      subtreeMiddlewareId,
      gatedMiddlewareId,
      unconditionalMiddlewareId,
      skippedMiddlewareId,
      localMiddlewareId,
    ]);
    expect(mapped.middlewareDetailed).toEqual([
      {
        id: subtreeMiddlewareId,
        config: "{}",
        origin: "subtree",
        subtreeOwnerId: ownerId,
      },
      {
        id: gatedMiddlewareId,
        config: null,
        origin: "subtree",
        subtreeOwnerId: ownerId,
      },
      {
        id: unconditionalMiddlewareId,
        config: null,
        origin: "subtree",
        subtreeOwnerId: ownerId,
      },
      {
        id: skippedMiddlewareId,
        config: null,
        origin: "local",
        subtreeOwnerId: null,
      },
      {
        id: localMiddlewareId,
        config: "{}",
        origin: "local",
        subtreeOwnerId: null,
      },
    ]);
  });

  test("summarizes conditional subtree entries on the owner", () => {
    const owner = mapStoreResourceToResourceModel({
      id: "test-subtree-resource-summary-owner",
      register: [],
      overrides: [],
      middleware: [],
      subtree: {
        resources: {
          middleware: [
            "audit",
            { use: { id: "gated" }, when: () => true },
            { use: { use: "nested" } },
            { notAMiddleware: true },
          ],
        },
      },
    } as any);

    expect(owner.subtree?.resources?.middleware).toEqual([
      "audit",
      "gated",
      "nested",
    ]);
  });

  test("treats middleware as local without a store", () => {
    const mapped = mapStoreResourceToResourceModel({
      id: "test-subtree-resource-no-store",
      register: [],
      overrides: [],
      middleware: [{ id: "mw-local" }],
    } as any);
    // Hand-built definitions may omit the middleware list entirely.
    const bare = mapStoreResourceToResourceModel({
      id: "test-subtree-resource-bare",
      register: [],
      overrides: [],
    } as any);
    const bareTask = mapStoreTaskToTaskModel({
      id: "test-subtree-resource-bare-task",
      dependencies: {},
    } as any);
    const task = mapStoreTaskToTaskModel({
      id: "test-subtree-resource-task",
      dependencies: {},
      middleware: [{ id: "mw-task-local", config: { retries: 2 } }],
    } as any);

    expect(mapped.middlewareDetailed).toEqual([
      { id: "mw-local", config: null, origin: "local", subtreeOwnerId: null },
    ]);
    expect(bare.middlewareDetailed).toEqual([]);
    expect(bareTask.middlewareDetailed).toEqual([]);
    expect(task.middlewareDetailed).toEqual([
      {
        id: "mw-task-local",
        config: JSON.stringify({ retries: 2 }),
        origin: "local",
        subtreeOwnerId: null,
      },
    ]);
  });

  test("canonicalizes owners and defaults legacy snapshot usages to local", () => {
    const owner: Resource = {
      id: "app.module",
      emits: [],
      dependsOn: [],
      middleware: [],
      overrides: [],
      registers: ["app.module.child"],
    };
    const child: Resource = {
      ...owner,
      id: "app.module.child",
      registers: [],
      middleware: ["app.module.middleware.resource.audit", "legacy"],
      middlewareDetailed: [
        {
          id: "audit",
          config: null,
          origin: "subtree",
          subtreeOwnerId: "module",
        },
        // Snapshots exported before origin tracking carry only id/config.
        { id: "legacy", config: null },
      ],
    };
    const resourceMiddleware = (id: string): Middleware => ({
      id,
      type: "resource",
      autoApply: { enabled: false, scope: null, hasPredicate: false },
      usedByTasks: [],
      usedByResources: ["app.module.child"],
    });

    const introspector = Introspector.deserialize({
      tasks: [],
      hooks: [],
      resources: [owner, child],
      events: [],
      middlewares: [
        resourceMiddleware("app.module.middleware.resource.audit"),
        resourceMiddleware("legacy"),
      ],
      tags: [],
    });

    expect(
      pickUsage(introspector.getMiddlewareUsagesForResource("app.module.child"))
    ).toEqual([
      {
        id: "app.module.middleware.resource.audit",
        origin: "subtree",
        subtreeOwnerId: "app.module",
      },
      { id: "legacy", origin: "local", subtreeOwnerId: null },
    ]);
    expect(
      pickUsage(introspector.getResourcesUsingMiddlewareDetailed("legacy"))
    ).toEqual([
      { id: "app.module.child", origin: "local", subtreeOwnerId: null },
    ]);
  });

  test("tolerates partial usage data from hand-built snapshots", () => {
    const resource: Resource = {
      id: "cache",
      emits: [],
      dependsOn: [],
      // No middlewareDetailed: only the id list survived.
      middleware: ["retry"],
      overrides: [],
      registers: [],
    };
    const introspector = Introspector.deserialize({
      tasks: [
        {
          id: "task-with-ghost",
          emits: [],
          dependsOn: [],
          middleware: ["ghost"],
          middlewareDetailed: [{ id: "ghost", config: null }],
        },
      ],
      // A hook serialized without any middleware field.
      hooks: [{ id: "hook", events: [], dependsOn: [], emits: [] }],
      resources: [resource],
      events: [],
      middlewares: [
        {
          id: "retry",
          type: "resource",
          autoApply: { enabled: false, scope: null, hasPredicate: false },
          usedByTasks: [],
          usedByResources: ["cache"],
        },
      ],
      tags: [],
    });

    expect(introspector.getMiddlewareUsagesForTask("task-with-ghost")).toEqual(
      []
    );
    expect(introspector.getMiddlewareUsagesForResource("cache")).toEqual([]);
    expect(introspector.getMiddlewareUsagesForResource("missing")).toEqual([]);
    expect(introspector.getTasksUsingMiddlewareDetailed("retry")).toEqual([]);
    expect(
      pickUsage(introspector.getResourcesUsingMiddlewareDetailed("retry"))
    ).toEqual([{ id: "cache", origin: "local", subtreeOwnerId: null }]);
  });
});
