import { event, resource, run, task } from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Lane Introspection", () => {
  const rpcPreviewTask = task({
    id: "test.lanes.tasks.pricingPreview",
    tags: [
      {
        id: "globals.tags.rpcLane",
        config: { lane: { id: "test.lanes.rpc.pricing-preview" } },
      },
    ],
    run: async () => "preview",
  });

  const rpcCatalogEvent = event({
    id: "test.lanes.events.catalogUpdated",
    tags: [
      {
        id: "globals.tags.rpcLane",
        config: { lane: { id: "test.lanes.rpc.catalog-updates" } },
      },
    ],
  });

  const eventLaneEvent = event({
    id: "test.lanes.events.catalogProjectionUpdated",
    tags: [
      {
        id: "globals.tags.eventLane",
        config: {
          lane: { id: "test.lanes.event.catalog-updates" },
          orderingKey: "supplierId",
          metadata: { domain: "catalog" },
        },
      },
    ],
  });

  const rpcLanesResource = resource({
    id: "platform.node.resources.rpcLanes",
    tags: [{ id: "globals.tags.rpcLanes" }],
    init: async () => ({}),
  });

  const rpcLanesRegistration = rpcLanesResource.with({
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
  });

  test("maps rpc and event lane summaries from tagsDetailed", async () => {
    const app = resource({
      id: "test.app.lanes.1",
      register: [
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ],
    });

    const runtime = await run(app, { debug: {} });
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

    await runtime.dispose();
  });

  test("returns rpc lanes resources and rpc lane members by lane id", async () => {
    const app = resource({
      id: "test.app.lanes.2",
      register: [
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ],
    });

    const runtime = await run(app, { debug: {} });
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

    await runtime.dispose();
  });

  test("resolves rpc lane owner resources and omits tunnel legacy api/state", async () => {
    const app = resource({
      id: "test.app.lanes.3",
      register: [
        rpcPreviewTask,
        rpcCatalogEvent,
        eventLaneEvent,
        rpcLanesRegistration,
      ],
    });

    const runtime = await run(app, { debug: {} });
    const introspector = new Introspector({ store: runtime.store });
    initializeFromStore(introspector, runtime.store);

    expect(introspector.getRpcLaneResourceForTask(rpcPreviewTask.id)?.id).toBe(
      "platform.node.resources.rpcLanes"
    );
    expect(
      introspector.getRpcLaneResourceForEvent(rpcCatalogEvent.id)?.id
    ).toBe("platform.node.resources.rpcLanes");

    const serializedPayload = JSON.stringify(introspector.serialize());
    expect(serializedPayload).not.toContain("tunnelInfo");
    expect("getTunnelForTask" in (introspector as any)).toBe(false);

    await runtime.dispose();
  });
});
