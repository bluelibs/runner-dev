import { globals, r, run } from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Lane Introspection", () => {
  const rpcLaneTag = globals.tags.rpcLane;
  const eventLaneTag = globals.tags.eventLane;
  const rpcLanesTag = globals.tags.rpcLanes;

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

  const rpcLanesConfig = {
    mode: "service",
    profile: "catalog",
    topology: {
      bindings: [
        {
          lane: { id: "test.lanes.rpc.pricing-preview" },
          communicator: { id: "test.communicators.pricing" },
        },
        {
          lane: { id: "test.lanes.rpc.catalog-updates" },
          communicator: { id: "test.communicators.catalog-events" },
        },
      ],
      profiles: {
        catalog: {
          serve: [
            { id: "test.lanes.rpc.pricing-preview" },
            { id: "test.lanes.rpc.catalog-updates" },
          ],
        },
      },
    },
  };

  const rpcPreviewTask = r
    .task("test.lanes.tasks.pricingPreview")
    .tags([buildRpcLaneTag("test.lanes.rpc.pricing-preview")])
    .run(async () => "preview")
    .build();

  const rpcCatalogEvent = r
    .event("test.lanes.events.catalogUpdated")
    .tags([buildRpcLaneTag("test.lanes.rpc.catalog-updates")])
    .build();

  const eventLaneEvent = r
    .event("test.lanes.events.catalogProjectionUpdated")
    .tags([
      buildEventLaneTag("test.lanes.event.catalog-updates", "supplierId", {
        domain: "catalog",
      }),
    ])
    .build();

  const rpcLanesResource = r
    .resource<typeof rpcLanesConfig>("platform.node.resources.rpcLanes")
    .tags([rpcLanesTag])
    .build();

  const rpcLanesRegistration = rpcLanesResource.with(rpcLanesConfig);

  test("maps rpc and event lane summaries from tagsDetailed", async () => {
    const app = r
      .resource("test.app.lanes.1")
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const taskNode = introspector.getTask(rpcPreviewTask.id);
      const rpcEventNode = introspector.getEvent(rpcCatalogEvent.id);
      const eventLaneNode = introspector.getEvent(eventLaneEvent.id);

      expect(taskNode?.rpcLane?.laneId).toBe("test.lanes.rpc.pricing-preview");
      expect(rpcEventNode?.rpcLane?.laneId).toBe(
        "test.lanes.rpc.catalog-updates"
      );
      expect(eventLaneNode?.eventLane?.laneId).toBe(
        "test.lanes.event.catalog-updates"
      );
      expect(eventLaneNode?.eventLane?.orderingKey).toBe("supplierId");
    } finally {
      await runtime.dispose();
    }
  });

  test("returns rpc lanes resources and rpc lane members by lane id", async () => {
    const app = r
      .resource("test.app.lanes.2")
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const rpcLanesResources = introspector.getRpcLanesResources();
      expect(rpcLanesResources.map((entry) => entry.id)).toContain(
        "platform.node.resources.rpcLanes"
      );

      expect(
        introspector
          .getTasksByRpcLane("test.lanes.rpc.pricing-preview")
          .map((entry) => entry.id)
      ).toContain(rpcPreviewTask.id);

      expect(
        introspector
          .getEventsByRpcLane("test.lanes.rpc.catalog-updates")
          .map((entry) => entry.id)
      ).toContain(rpcCatalogEvent.id);
    } finally {
      await runtime.dispose();
    }
  });

  test("resolves rpc lane owner resources and omits tunnel legacy api/state", async () => {
    const app = r
      .resource("test.app.lanes.3")
      .register([
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      expect(
        introspector.getRpcLaneResourceForTask(rpcPreviewTask.id)?.id
      ).toBe("platform.node.resources.rpcLanes");
      expect(
        introspector.getRpcLaneResourceForEvent(rpcCatalogEvent.id)?.id
      ).toBe("platform.node.resources.rpcLanes");

      const serializedPayload = JSON.stringify(introspector.serialize());
      expect(serializedPayload).not.toContain("tunnelInfo");
      expect("getTunnelForTask" in introspector).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
