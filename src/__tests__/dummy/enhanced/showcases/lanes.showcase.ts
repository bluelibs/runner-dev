import { tags, r } from "@bluelibs/runner/node";
import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import {
  eventLanesResource,
  rpcLanesResource,
  type IEventLaneQueue,
  type EventLanesResourceConfig,
  type RpcLanesResourceConfig,
} from "@bluelibs/runner/node";
import {
  LaneCatalogProjectionUpdatedPayloadSchema,
  LaneCatalogUpdatedPayloadSchema,
  RpcCatalogSyncInputSchema,
  RpcCatalogSyncResultSchema,
  RpcPricingPreviewInputSchema,
  RpcPricingPreviewResultSchema,
} from "./schemas";

const rpcLaneTag = (laneId: string) =>
  tags.rpcLane.with({ lane: { id: laneId } });

const eventLaneTag = (
  laneId: string,
  _orderingKey: string,
  _metadata: Record<string, unknown>
) =>
  tags.eventLane.with({
    lane: { id: laneId },
  });

const createRpcCommunicatorResource = (id: string) =>
  r
    .resource(id)
    .init(async () => ({
      task: async (_taskId: string, _input?: unknown) => null,
      event: async (_eventId: string, _data?: unknown) => undefined,
    }))
    .build();

const catalogUpdatesQueueResource = r
  .resource("catalog-updates-queue")
  .init(
    async (): Promise<IEventLaneQueue> => ({
      enqueue: async () => "message-1",
      consume: async () => undefined,
      ack: async () => undefined,
      nack: async () => undefined,
    })
  )
  .build();

const pricingCommunicatorResource = createRpcCommunicatorResource(
  "pricing-communicator"
);

const catalogSyncCommunicatorResource = createRpcCommunicatorResource(
  "catalog-sync-communicator"
);

const catalogEventsCommunicatorResource = createRpcCommunicatorResource(
  "catalog-events-communicator"
);

export const rpcLaneCatalogUpdatedEvent = r
  .event("catalog-updated")
  .meta({
    title: "RPC Lane Catalog Updated",
    description: "RPC lane tagged showcase event.",
  })
  .tags([rpcLaneTag("rpc-catalog-updates")])
  .payloadSchema(LaneCatalogUpdatedPayloadSchema)
  .build();

export const eventLaneCatalogProjectionUpdatedEvent = r
  .event("catalog-projection-updated")
  .meta({
    title: "Event Lane Catalog Projection Updated",
    description: "Event lane tagged showcase event.",
  })
  .tags([
    eventLaneTag("event-catalog-updates", "supplierId", {
      domain: "catalog",
    }),
  ])
  .payloadSchema(LaneCatalogProjectionUpdatedPayloadSchema)
  .build();

export const rpcLanePricingPreviewTask = r
  .task("pricing-preview")
  .meta({
    title: "RPC Lane Pricing Preview",
    description: "Task tagged with tags.rpcLane.",
  })
  .tags([rpcLaneTag("rpc-pricing-preview")])
  .inputSchema(RpcPricingPreviewInputSchema)
  .resultSchema(RpcPricingPreviewResultSchema)
  .run(async (input) => ({
    sku: input.sku,
    adjustedPrice: Number((input.basePrice * 1.03).toFixed(2)),
    source: "rpc-lane-task" as const,
  }))
  .build();

export const rpcLaneCatalogSyncTask = r
  .task("catalog-sync")
  .meta({
    title: "RPC Lane Catalog Sync",
    description:
      "Companion rpc-lane task that emits the lane-tagged catalog updated event.",
  })
  .tags([rpcLaneTag("rpc-catalog-sync")])
  .dependencies({
    emitCatalogUpdated: rpcLaneCatalogUpdatedEvent,
  })
  .inputSchema(RpcCatalogSyncInputSchema)
  .resultSchema(RpcCatalogSyncResultSchema)
  .run(async (input, { emitCatalogUpdated }) => {
    await emitCatalogUpdated({
      supplierId: input.supplierId,
      updatedAt: new Date(),
    });

    return {
      supplierId: input.supplierId,
      syncedCount: input.changedSkus.length,
      emittedEvent: rpcLaneCatalogUpdatedEvent.id,
    };
  })
  .build();

export const rpcLanesShowcaseResource: typeof rpcLanesResource =
  rpcLanesResource;

const rpcLanesShowcaseConfig: RpcLanesResourceConfig = {
  mode: "network",
  profile: "catalog",
  topology: {
    bindings: [
      {
        lane: { id: "rpc-pricing-preview" },
        communicator: pricingCommunicatorResource,
      },
      {
        lane: { id: "rpc-catalog-sync" },
        communicator: catalogSyncCommunicatorResource,
      },
      {
        lane: { id: "rpc-catalog-updates" },
        communicator: catalogEventsCommunicatorResource,
      },
    ],
    profiles: {
      catalog: {
        serve: [
          { id: "rpc-pricing-preview" },
          { id: "rpc-catalog-sync" },
          { id: "rpc-catalog-updates" },
        ],
      },
    },
  },
};

export const rpcLanesShowcaseRegistration: RegisterableItems =
  rpcLanesShowcaseResource.with(rpcLanesShowcaseConfig);

export const eventLanesShowcaseResource: typeof eventLanesResource =
  eventLanesResource;

const eventLanesShowcaseConfig: EventLanesResourceConfig = {
  mode: "network",
  profile: "catalog-events",
  topology: {
    relaySourcePrefix: "runner.event-lanes.relay:",
    bindings: [
      {
        lane: { id: "event-catalog-updates" },
        queue: catalogUpdatesQueueResource,
        prefetch: 8,
      },
    ],
    profiles: {
      "catalog-events": {
        consume: [{ id: "event-catalog-updates" }],
      },
    },
  },
};

export const eventLanesShowcaseRegistration: RegisterableItems =
  eventLanesShowcaseResource.with(eventLanesShowcaseConfig);

const rpcLanesShowcaseOverride = r.override(rpcLanesShowcaseResource, (async (
  config,
  _dependencies,
  _context
) => ({
  profile: config.profile,
  mode: "network",
  serveTaskIds: [],
  serveEventIds: [],
  taskAllowAsyncContext: {},
  eventAllowAsyncContext: {},
  taskAsyncContextAllowList: {},
  eventAsyncContextAllowList: {},
  communicatorByLaneId: new Map(),
  exposure: null,
})) satisfies NonNullable<typeof rpcLanesShowcaseResource.init>);

const eventLanesShowcaseOverride = r.override(
  eventLanesShowcaseResource,
  (async (config, _dependencies, _context) => ({
    profile: config.profile,
    consumers: 0,
  })) satisfies NonNullable<typeof eventLanesShowcaseResource.init>
);

export const lanesShowcaseOverrides: OverridableElements[] = [
  rpcLanesShowcaseOverride,
  eventLanesShowcaseOverride,
];

export const lanesShowcaseRegistrations: RegisterableItems[] = [
  pricingCommunicatorResource,
  catalogSyncCommunicatorResource,
  catalogEventsCommunicatorResource,
  catalogUpdatesQueueResource,
  rpcLaneCatalogUpdatedEvent,
  eventLaneCatalogProjectionUpdatedEvent,
  rpcLanePricingPreviewTask,
  rpcLaneCatalogSyncTask,
  rpcLanesShowcaseRegistration,
  eventLanesShowcaseRegistration,
];
