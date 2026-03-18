import { resources, defineResource, run, type Store } from "@bluelibs/runner";
import { graphql } from "graphql";
import { introspector } from "../../resources/introspector.resource";
import type { Introspector } from "../../resources/models/Introspector";
import { schema } from "../../schema";
import {
  catalogSearchTask,
  createEnhancedSuperApp,
  durableOrderApprovalTask,
  enhancedSuperAppIds,
  eventLanesShowcaseResource,
  featuredInspectorTask,
  featuredTag,
  interceptorBaseTask,
  interceptorInstallerResource,
  invalidInputError,
  isolationBoundaryResource,
  eventLaneCatalogProjectionUpdatedEvent,
  privateCacheResource,
  publicCatalogResource,
  rpcLaneCatalogUpdatedEvent,
  rpcLanePricingPreviewTask,
  rpcLanesShowcaseResource,
  showcaseDurableResource,
  supportRequestContext,
} from "../dummy/enhanced";

type TestContextValue = {
  introspector: Introspector;
  store: Store;
  live: { logs: unknown[] };
  logger: Console;
};

const catalogIds = enhancedSuperAppIds.catalog;
const ordersIds = enhancedSuperAppIds.orders;
const platformIds = enhancedSuperAppIds.platform;

const isolationBoundaryIds = {
  resource(localId: string) {
    return `${catalogIds.resource(isolationBoundaryResource.id)}.${localId}`;
  },
  task(localId: string) {
    return `${catalogIds.resource(
      isolationBoundaryResource.id
    )}.tasks.${localId}`;
  },
};

describe("Enhanced play showcase app", () => {
  let contextValue: TestContextValue;
  let runtime: Awaited<ReturnType<typeof run>> | null = null;

  beforeAll(async () => {
    const probe = defineResource({
      id: "probe-enhanced-play-showcase",
      dependencies: {
        introspector,
        store: resources.store,
      },
      async init(_config, { introspector, store }) {
        contextValue = {
          introspector,
          store,
          // Required by GraphQL context contract for live resolvers.
          live: { logs: [] },
          logger: console,
        };
      },
    });

    const app = createEnhancedSuperApp([introspector, probe]);
    runtime = await run(app);
  });

  afterAll(async () => {
    if (runtime) {
      await runtime.dispose();
    }
  });

  test("boots and exposes expected showcase nodes", () => {
    expect(
      contextValue.introspector.getTask(
        isolationBoundaryIds.task(catalogSearchTask.id)
      )
    ).toBeTruthy();
    expect(
      contextValue.introspector.getResource(
        catalogIds.resource(isolationBoundaryResource.id)
      )
    ).toBeTruthy();
    expect(
      contextValue.introspector.getTask(
        ordersIds.task(durableOrderApprovalTask.id)
      )
    ).toBeTruthy();
    expect(
      contextValue.introspector.getResource(
        catalogIds.resource(rpcLanesShowcaseResource.id)
      )
    ).toBeTruthy();
    expect(
      contextValue.introspector.getResource(
        catalogIds.resource(eventLanesShowcaseResource.id)
      )
    ).toBeTruthy();
  });

  test("attaches meta to lane resources", () => {
    const rpcLanesNode = contextValue.introspector.getResource(
      catalogIds.resource(rpcLanesShowcaseResource.id)
    );
    const eventLanesNode = contextValue.introspector.getResource(
      catalogIds.resource(eventLanesShowcaseResource.id)
    );

    expect(rpcLanesNode?.meta?.title).toBe("RPC Lanes");
    expect(rpcLanesNode?.meta?.description).toContain("catalog RPC lane");
    expect(eventLanesNode?.meta?.title).toBe("Event Lanes");
    expect(eventLanesNode?.meta?.description).toContain("event-lane topology");
  });

  test("exposes tags and tag handlers", async () => {
    const result = await graphql({
      schema,
      source: `
        query FeaturedTag($tagId: ID!) {
          tag(id: $tagId) {
            id
            tasks { id }
            resources { id }
          }
        }
      `,
      variableValues: { tagId: catalogIds.tag(featuredTag.id) },
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as {
      tag: {
        id: string;
        tasks: Array<{ id: string }>;
        resources: Array<{ id: string }>;
      };
    };

    expect(data.tag.id).toBe(catalogIds.tag(featuredTag.id));
    expect(data.tag.tasks.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([isolationBoundaryIds.task(catalogSearchTask.id)])
    );
    expect(data.tag.resources.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        isolationBoundaryIds.resource(publicCatalogResource.id),
      ])
    );

    const handlers = contextValue.introspector.getTagHandlers(
      catalogIds.tag(featuredTag.id)
    );
    expect(handlers).toBeTruthy();
    expect(handlers.tasks.map((task: { id: string }) => task.id)).toEqual(
      expect.arrayContaining([catalogIds.task(featuredInspectorTask.id)])
    );
  });

  test("exposes isolation wildcard rules and visibility", async () => {
    const result = await graphql({
      schema,
      source: `
        query IsolationVisibility {
          resources(idIncludes: "isolation-boundary") {
            id
            isPrivate
            isolation {
              exports
              deny
              only
            }
          }
        }
      `,
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as {
      resources: Array<{
        id: string;
        isPrivate: boolean;
        isolation: { exports: string[]; deny: string[]; only: string[] } | null;
      }>;
    };

    const boundary = data.resources.find(
      (resource) =>
        resource.id === catalogIds.resource(isolationBoundaryResource.id)
    );
    const publicResource = data.resources.find(
      (resource) =>
        resource.id === isolationBoundaryIds.resource(publicCatalogResource.id)
    );
    const privateResource = data.resources.find(
      (resource) =>
        resource.id === isolationBoundaryIds.resource(privateCacheResource.id)
    );

    expect(boundary).toBeTruthy();
    expect(publicResource).toBeTruthy();
    expect(privateResource).toBeTruthy();

    expect(boundary?.isolation?.exports).toEqual(
      expect.arrayContaining([
        isolationBoundaryIds.resource(publicCatalogResource.id),
        isolationBoundaryIds.task(catalogSearchTask.id),
      ])
    );
    expect(boundary?.isolation?.deny).toEqual(
      expect.arrayContaining([
        isolationBoundaryIds.resource(privateCacheResource.id),
      ])
    );
    expect(publicResource?.isPrivate).toBe(false);
    expect(privateResource?.isPrivate).toBe(true);
  });

  test("surfaces runtime interceptor metadata", async () => {
    const result = await graphql({
      schema,
      source: `
        query Interceptors {
          tasks(idIncludes: "interceptor-") {
            id
            hasInterceptors
            interceptorCount
            interceptorOwnerIds
          }
        }
      `,
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as {
      tasks: Array<{
        id: string;
        hasInterceptors: boolean;
        interceptorCount: number;
        interceptorOwnerIds: string[];
      }>;
    };

    const baseTask = data.tasks.find(
      (task) => task.id === catalogIds.task(interceptorBaseTask.id)
    );
    expect(baseTask).toBeTruthy();
    expect(baseTask?.hasInterceptors).toBe(true);
    expect(baseTask?.interceptorCount).toBeGreaterThanOrEqual(1);
    expect(baseTask?.interceptorOwnerIds).toEqual(
      expect.arrayContaining([
        catalogIds.resource(interceptorInstallerResource.id),
      ])
    );
  });

  test("links rpc lane members to rpc lanes resource metadata", () => {
    const rpcLanesResource = contextValue.introspector.getResource(
      catalogIds.resource(rpcLanesShowcaseResource.id)
    );
    expect(rpcLanesResource).toBeTruthy();

    const taskLaneId = contextValue.introspector.getRpcLaneForTask(
      catalogIds.task(rpcLanePricingPreviewTask.id)
    );
    expect(taskLaneId).toBe("rpc-pricing-preview");

    const owner = contextValue.introspector.getRpcLaneResourceForTask(
      catalogIds.task(rpcLanePricingPreviewTask.id)
    );
    expect(owner?.id).toBe(catalogIds.resource(rpcLanesShowcaseResource.id));

    const laneEvent = contextValue.introspector.getEvent(
      catalogIds.event(rpcLaneCatalogUpdatedEvent.id)
    );
    expect(laneEvent?.rpcLane?.laneId).toBe("rpc-catalog-updates");

    const eventLaneEvent = contextValue.introspector.getEvent(
      catalogIds.event(eventLaneCatalogProjectionUpdatedEvent.id)
    );
    expect(eventLaneEvent?.eventLane?.laneId).toBe("event-catalog-updates");
  });

  test("keeps durable metadata and support sections visible", async () => {
    const durableResult = await graphql({
      schema,
      source: `
        query DurableMeta($taskId: ID!) {
          task(id: $taskId) {
            id
            isDurable
            durableResource {
              id
            }
          }
        }
      `,
      variableValues: {
        taskId: ordersIds.task(durableOrderApprovalTask.id),
      },
      contextValue,
    });

    expect(durableResult.errors).toBeUndefined();
    const durableData = durableResult.data as {
      task: { id: string; isDurable: boolean; durableResource: { id: string } };
    };

    expect(durableData.task.id).toBe(
      ordersIds.task(durableOrderApprovalTask.id)
    );
    expect(durableData.task.isDurable).toBe(true);
    expect(durableData.task.durableResource.id).toBe(
      ordersIds.resource(showcaseDurableResource.id)
    );

    const asyncContextIds = contextValue.introspector
      .getAsyncContexts()
      .map((entry: { id: string }) => entry.id);
    const errorIds = contextValue.introspector
      .getErrors()
      .map((entry: { id: string }) => entry.id);

    expect(asyncContextIds).toEqual(
      expect.arrayContaining([
        platformIds.asyncContext(supportRequestContext.id),
      ])
    );
    expect(errorIds).toEqual(
      expect.arrayContaining([platformIds.error(invalidInputError.id)])
    );
  });
});
