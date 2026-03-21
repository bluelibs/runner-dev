import { r, run } from "@bluelibs/runner";
import {
  eventLanesResource,
  rpcLanesResource,
  type RpcLanesResourceConfig,
  tags,
  type EventLanesResourceConfig,
} from "@bluelibs/runner/node";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";
import { RPC_LANES_RESOURCE_ID } from "../../utils/lane-resources";

describe("Lane Introspection", () => {
  const rpcLaneTag = tags.rpcLane;

  const canonicalTaskId = (appId: string, localId: string) =>
    `${appId}.tasks.${localId}`;
  const canonicalEventId = (appId: string, localId: string) =>
    `${appId}.events.${localId}`;
  const canonicalResourceId = (appId: string, localId: string) =>
    `${appId}.${localId}`;

  const buildRpcLaneTag = (laneId: string) =>
    rpcLaneTag.with({ lane: { id: laneId } });

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
  const eventLaneQueue = {
    enqueue: async () => "message-1",
    consume: async () => undefined,
    ack: async () => undefined,
    nack: async () => undefined,
  };

  const rpcLanesConfig: RpcLanesResourceConfig = {
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
    .build();

  const eventCatalogUpdatesLane = r
    .eventLane("test-lanes-event-catalog-updates")
    .applyTo([eventLaneEvent])
    .build();

  const eventLanesConfig: EventLanesResourceConfig = {
    mode: "network",
    profile: "catalog-events",
    topology: {
      bindings: [
        {
          lane: eventCatalogUpdatesLane,
          queue: eventLaneQueue,
        },
      ],
      profiles: {
        "catalog-events": {
          consume: [{ lane: eventCatalogUpdatesLane }],
        },
      },
    },
  };

  const rpcLanesRegistration = rpcLanesResource.with(rpcLanesConfig);
  const eventLanesRegistration = eventLanesResource.with(eventLanesConfig);

  test("tracks the Runner rpc lanes internal resource id", () => {
    expect(RPC_LANES_RESOURCE_ID).toBe("runner.node.rpcLanes");
    expect(rpcLanesResource.id).toBe("rpcLanes");
  });

  test("maps rpc tag summaries and event lane applyTo summaries", async () => {
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
        eventLanesRegistration,
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
    } finally {
      await runtime.dispose();
    }
  });

  test("merges event lane bindings with profile consumers that only reference the lane id", async () => {
    const appId = "test-app-lanes-merge";
    const mergeEvent = r
      .event("test-lanes-events-mergeProjectionUpdated")
      .build();
    const mergeLaneId = "test-lanes-event-merge-updates";
    const mergeLaneDefinition = {
      ...r.eventLane(mergeLaneId).applyTo([mergeEvent]).build(),
      orderingKey: "tenantId",
      metadata: { source: "binding" },
    };
    const mergeConfig: EventLanesResourceConfig = {
      mode: "network",
      profile: "catalog-events",
      topology: {
        bindings: [
          {
            lane: mergeLaneDefinition,
            queue: eventLaneQueue,
          },
        ],
        profiles: {
          "catalog-events": {
            consume: [{ lane: { id: mergeLaneId } }],
          },
        },
      },
    };

    const app = r
      .resource(appId)
      .register([mergeEvent, eventLanesResource.with(mergeConfig)])
      .build();

    const runtime = await run(app, { debug: {} });
    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const mergeEventNode = introspector.getEvent(
        canonicalEventId(appId, mergeEvent.id)
      );

      expect(mergeEventNode?.eventLane).toEqual({
        laneId: mergeLaneId,
        orderingKey: "tenantId",
        metadata: JSON.stringify({ source: "binding" }),
      });
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
        eventLanesRegistration,
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
        eventLanesRegistration,
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
