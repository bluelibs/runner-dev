import { globals, resource, run, type Store } from "@bluelibs/runner";
import { graphql } from "graphql";
import { introspector } from "../../resources/introspector.resource";
import type { Introspector } from "../../resources/models/Introspector";
import { schema } from "../../schema";
import {
  catalogSearchTask,
  createEnhancedSuperApp,
  durableOrderApprovalTask,
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

describe("Enhanced play showcase app", () => {
  let contextValue: TestContextValue;
  let runtime: Awaited<ReturnType<typeof run>> | null = null;

  beforeAll(async () => {
    const probe = resource({
      id: "probe.enhanced.play.showcase",
      dependencies: {
        introspector,
        store: globals.resources.store,
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
      contextValue.introspector.getTask(catalogSearchTask.id)
    ).toBeTruthy();
    expect(
      contextValue.introspector.getResource(isolationBoundaryResource.id)
    ).toBeTruthy();
    expect(
      contextValue.introspector.getTask(durableOrderApprovalTask.id)
    ).toBeTruthy();
    expect(
      contextValue.introspector.getResource(rpcLanesShowcaseResource.id)
    ).toBeTruthy();
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
      variableValues: { tagId: featuredTag.id },
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

    expect(data.tag.id).toBe(featuredTag.id);
    expect(data.tag.tasks.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([catalogSearchTask.id])
    );
    expect(data.tag.resources.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([publicCatalogResource.id])
    );

    const handlers = contextValue.introspector.getTagHandlers(featuredTag.id);
    expect(handlers).toBeTruthy();
    expect(handlers.tasks.map((task: { id: string }) => task.id)).toEqual(
      expect.arrayContaining([featuredInspectorTask.id])
    );
  });

  test("exposes isolation wildcard rules and visibility", async () => {
    const result = await graphql({
      schema,
      source: `
        query IsolationVisibility {
          resources(idIncludes: "app.examples.isolation.resources") {
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
      (resource) => resource.id === isolationBoundaryResource.id
    );
    const publicResource = data.resources.find(
      (resource) => resource.id === publicCatalogResource.id
    );
    const privateResource = data.resources.find(
      (resource) => resource.id === privateCacheResource.id
    );

    expect(boundary).toBeTruthy();
    expect(publicResource).toBeTruthy();
    expect(privateResource).toBeTruthy();

    expect(boundary?.isolation?.exports).toEqual(
      expect.arrayContaining([
        "app.examples.isolation.resources.public.catalog",
        "app.examples.tags.tasks.catalogSearch",
      ])
    );
    expect(boundary?.isolation?.deny).toEqual(
      expect.arrayContaining(["app.examples.isolation.resources.private.cache"])
    );
    expect(publicResource?.isPrivate).toBe(false);
    expect(privateResource?.isPrivate).toBe(true);
  });

  test("surfaces runtime interceptor metadata", async () => {
    const result = await graphql({
      schema,
      source: `
        query Interceptors {
          tasks(idIncludes: "app.examples.interceptors.tasks.") {
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
      (task) => task.id === interceptorBaseTask.id
    );
    expect(baseTask).toBeTruthy();
    expect(baseTask?.hasInterceptors).toBe(true);
    expect(baseTask?.interceptorCount).toBeGreaterThanOrEqual(1);
    expect(baseTask?.interceptorOwnerIds).toEqual(
      expect.arrayContaining([interceptorInstallerResource.id])
    );
  });

  test("links rpc lane members to rpc lanes resource metadata", () => {
    const rpcLanesResource = contextValue.introspector.getResource(
      rpcLanesShowcaseResource.id
    );
    expect(rpcLanesResource).toBeTruthy();

    const taskLaneId = contextValue.introspector.getRpcLaneForTask(
      rpcLanePricingPreviewTask.id
    );
    expect(taskLaneId).toBe("app.examples.lanes.rpc.pricing-preview");

    const owner = contextValue.introspector.getRpcLaneResourceForTask(
      rpcLanePricingPreviewTask.id
    );
    expect(owner?.id).toBe(rpcLanesShowcaseResource.id);

    const laneEvent = contextValue.introspector.getEvent(
      rpcLaneCatalogUpdatedEvent.id
    );
    expect(laneEvent?.rpcLane?.laneId).toBe(
      "app.examples.lanes.rpc.catalog-updates"
    );

    const eventLaneEvent = contextValue.introspector.getEvent(
      eventLaneCatalogProjectionUpdatedEvent.id
    );
    expect(eventLaneEvent?.eventLane?.laneId).toBe(
      "app.examples.lanes.event.catalog-updates"
    );
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
      variableValues: { taskId: durableOrderApprovalTask.id },
      contextValue,
    });

    expect(durableResult.errors).toBeUndefined();
    const durableData = durableResult.data as {
      task: { id: string; isDurable: boolean; durableResource: { id: string } };
    };

    expect(durableData.task.id).toBe(durableOrderApprovalTask.id);
    expect(durableData.task.isDurable).toBe(true);
    expect(durableData.task.durableResource.id).toBe(
      showcaseDurableResource.id
    );

    const asyncContextIds = contextValue.introspector
      .getAsyncContexts()
      .map((entry: { id: string }) => entry.id);
    const errorIds = contextValue.introspector
      .getErrors()
      .map((entry: { id: string }) => entry.id);

    expect(asyncContextIds).toEqual(
      expect.arrayContaining([supportRequestContext.id])
    );
    expect(errorIds).toEqual(expect.arrayContaining([invalidInputError.id]));
  });
});
