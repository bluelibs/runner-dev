import { r, run } from "@bluelibs/runner";
import { rpcLanesResource, tags } from "@bluelibs/runner/node";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Lane Introspection", () => {
  const rpcLaneTag = tags.rpcLane;
  const eventLaneTag = tags.eventLane;

  const canonicalTaskId = (appId: string, localId: string) =>
    `${appId}.tasks.${localId}`;
  const canonicalEventId = (appId: string, localId: string) =>
    `${appId}.events.${localId}`;
  const canonicalResourceId = (appId: string, localId: string) =>
    `${appId}.${localId}`;

  const buildRpcLaneTag = (laneId: string) =>
    rpcLaneTag.with({ lane: { id: laneId } });

  const buildEventLaneTag = (
    laneId: string,
    orderingKey: string,
    metadata: Record<string, unknown>
  ) =>
    eventLaneTag.with({
      lane: { id: laneId },
      orderingKey,
      metadata,
    });

  const createRpcCommunicatorResource = (id: string) =>
    r
      .resource(id)
      .init(async () => ({
        task: async () => ({ ok: true }),
        event: async () => undefined,
        eventWithResult: async () => ({ ok: true }),
      }))
      .build();

  const pricingCommunicatorResource = createRpcCommunicatorResource(
    "test-communicators-pricing"
  );
  const catalogEventsCommunicatorResource = createRpcCommunicatorResource(
    "test-communicators-catalog-events"
  );

  const rpcLanesConfig = {
    mode: "network",
    profile: "catalog",
    topology: {
      bindings: [
        {
          lane: { id: "test-lanes-rpc-pricing-preview" },
          communicator: pricingCommunicatorResource,
        },
        {
          lane: { id: "test-lanes-rpc-catalog-updates" },
          communicator: catalogEventsCommunicatorResource,
        },
      ],
      profiles: {
        catalog: {
          serve: [
            { id: "test-lanes-rpc-pricing-preview" },
            { id: "test-lanes-rpc-catalog-updates" },
          ],
        },
      },
    },
  };

  const rpcPreviewTask = r
    .task("test-lanes-tasks-pricingPreview")
    .tags([buildRpcLaneTag("test-lanes-rpc-pricing-preview")])
    .run(async () => "preview")
    .build();

  const rpcCatalogEvent = r
    .event("test-lanes-events-catalogUpdated")
    .tags([buildRpcLaneTag("test-lanes-rpc-catalog-updates")])
    .build();

  const eventLaneEvent = r
    .event("test-lanes-events-catalogProjectionUpdated")
    .tags([
      buildEventLaneTag("test-lanes-event-catalog-updates", "supplierId", {
        domain: "catalog",
      }),
    ])
    .build();

  const rpcLanesRegistration = rpcLanesResource.with(rpcLanesConfig);

  test("maps rpc and event lane summaries from tagsDetailed", async () => {
    const appId = "test-app-lanes-1";
    const app = r
      .resource(appId)
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        pricingCommunicatorResource,
        catalogEventsCommunicatorResource,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const taskNode = introspector.getTask(
        canonicalTaskId(appId, rpcPreviewTask.id)
      );
      const rpcEventNode = introspector.getEvent(
        canonicalEventId(appId, rpcCatalogEvent.id)
      );
      const eventLaneNode = introspector.getEvent(
        canonicalEventId(appId, eventLaneEvent.id)
      );

      expect(taskNode?.rpcLane?.laneId).toBe("test-lanes-rpc-pricing-preview");
      expect(rpcEventNode?.rpcLane?.laneId).toBe(
        "test-lanes-rpc-catalog-updates"
      );
      expect(eventLaneNode?.eventLane?.laneId).toBe(
        "test-lanes-event-catalog-updates"
      );
      expect(eventLaneNode?.eventLane?.orderingKey).toBe("supplierId");
    } finally {
      await runtime.dispose();
    }
  });

  test("returns rpc lanes resources and rpc lane members by lane id", async () => {
    const appId = "test-app-lanes-2";
    const app = r
      .resource(appId)
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        pricingCommunicatorResource,
        catalogEventsCommunicatorResource,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const rpcLanesResources = introspector.getRpcLanesResources();
      expect(rpcLanesResources.map((entry) => entry.id)).toContain(
        canonicalResourceId(appId, rpcLanesResource.id)
      );

      expect(
        introspector
          .getTasksByRpcLane("test-lanes-rpc-pricing-preview")
          .map((entry) => entry.id)
      ).toContain(canonicalTaskId(appId, rpcPreviewTask.id));

      expect(
        introspector
          .getEventsByRpcLane("test-lanes-rpc-catalog-updates")
          .map((entry) => entry.id)
      ).toContain(canonicalEventId(appId, rpcCatalogEvent.id));
    } finally {
      await runtime.dispose();
    }
  });

  test("resolves rpc lane owner resources and omits tunnel legacy api/state", async () => {
    const appId = "test-app-lanes-3";
    const app = r
      .resource(appId)
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        pricingCommunicatorResource,
        catalogEventsCommunicatorResource,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      expect(
        introspector.getRpcLaneResourceForTask(
          canonicalTaskId(appId, rpcPreviewTask.id)
        )?.id
      ).toBe(canonicalResourceId(appId, rpcLanesResource.id));
      expect(
        introspector.getRpcLaneResourceForEvent(
          canonicalEventId(appId, rpcCatalogEvent.id)
        )?.id
      ).toBe(canonicalResourceId(appId, rpcLanesResource.id));

      const serializedPayload = JSON.stringify(introspector.serialize());
      expect(serializedPayload).not.toContain("tunnelInfo");
      expect("getTunnelForTask" in introspector).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
