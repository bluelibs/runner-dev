import { tags, r } from "@bluelibs/runner/node";
import {
  defineResource,
  type IResource,
  type OverridableElements,
  type RegisterableItems,
} from "@bluelibs/runner";
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

type LaneResourceMeta = { title: string; description: string };

type ResourceWithMeta<TResource> = TResource extends IResource<
  infer TConfig,
  infer TValue,
  infer TDependencies,
  infer TContext,
  any,
  infer TTags,
  infer TMiddleware
>
  ? IResource<
      TConfig,
      TValue,
      TDependencies,
      TContext,
      LaneResourceMeta,
      TTags,
      TMiddleware
    >
  : never;

const rpcLaneTag = (laneId: string) =>
  tags.rpcLane.with({ lane: { id: laneId } });

const createRpcCommunicatorResource = (
  id: string,
  meta: { title: string; description: string }
) =>
  r
    .resource(id)
    .meta(meta)
    .init(async () => ({
      task: async (_taskId: string, _input?: unknown) => null,
      event: async (_eventId: string, _data?: unknown) => undefined,
    }))
    .build();

const catalogUpdatesQueueResource = r
  .resource("catalog-updates-queue")
  .meta({
    title: "Catalog Updates Queue",
    description:
      "Queues catalog projection work for the event-lane example.\n\n- Minimal in-memory queue\n- Exists to make lane ownership visible in topology",
  })
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
  "pricing-communicator",
  {
    title: "Pricing Communicator",
    description:
      "Stub communicator serving the pricing preview RPC lane.\n\n- No real transport\n- Kept only for lane topology",
  }
);

const catalogSyncCommunicatorResource = createRpcCommunicatorResource(
  "catalog-sync-communicator",
  {
    title: "Catalog Sync Communicator",
    description:
      "Stub communicator serving the catalog sync RPC lane.\n\n- Returns inert values\n- Gives the lane resource concrete bindings",
  }
);

const catalogEventsCommunicatorResource = createRpcCommunicatorResource(
  "catalog-events-communicator",
  {
    title: "Catalog Events Communicator",
    description:
      "Stub communicator for the catalog-updated event lane binding.\n\n- No transport side effects\n- Useful for docs and blast radius",
  }
);

export const rpcLaneCatalogUpdatedEvent = r
  .event("catalog-updated")
  .meta({
    title: "Catalog Updated",
    description:
      "Signals that catalog data changed and should fan out through the lane graph.\n\n- Tagged with `rpcLane`\n- Emitted by the sync task",
  })
  .tags([rpcLaneTag("rpc-catalog-updates")])
  .payloadSchema(LaneCatalogUpdatedPayloadSchema)
  .build();

export const eventLaneCatalogProjectionUpdatedEvent = r
  .event("catalog-projection-updated")
  .meta({
    title: "Catalog Projection Updated",
    description:
      "Signals that the read model caught up with a catalog update.\n\n- Routed through the event-lane example\n- Emitted by the projection hook",
  })
  .payloadSchema(LaneCatalogProjectionUpdatedPayloadSchema)
  .build();

export const catalogProjectionResource = r
  .resource("catalog-projection")
  .meta({
    title: "Catalog Projection",
    description:
      "Tiny read-model placeholder for the catalog graph.\n\n- Holds no real state\n- Exists so topology shows resource ownership around projection updates",
  })
  .init(async () => ({
    lastProjectedSupplierId: null as string | null,
  }))
  .build();

export const catalogProjectionHook = r
  .hook("catalog-projection-sync")
  .meta({
    title: "Projection Sync",
    description:
      "Listens for catalog updates and emits the projection-updated event.\n\n- Minimal glue hook\n- Added to make event flow visible without real projection work",
  })
  .on(rpcLaneCatalogUpdatedEvent)
  .dependencies({
    catalogProjectionResource,
    emitProjectionUpdated: eventLaneCatalogProjectionUpdatedEvent,
  })
  .run(async (input, { emitProjectionUpdated }) => {
    await emitProjectionUpdated({
      supplierId: input.data.supplierId,
      projectedAt: new Date(),
    });
  })
  .build();

const catalogUpdatesEventLane = r
  .eventLane("event-catalog-updates")
  .applyTo([eventLaneCatalogProjectionUpdatedEvent])
  .build();

export const rpcLanePricingPreviewTask = r
  .task("pricing-preview")
  .meta({
    title: "Pricing Preview",
    description:
      "Returns a tiny computed price preview for the RPC lane example.\n\n- No external calls\n- Exists mainly to show task-to-lane ownership",
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
    title: "Catalog Sync",
    description:
      "Emits the `catalog-updated` event after a pretend supplier sync.\n\n- Minimal task logic\n- Main producer for the catalog event flow",
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
      changedSkus: input.changedSkus,
      source: "catalog-sync" as const,
      updatedAt: new Date(),
    });

    return {
      supplierId: input.supplierId,
      syncedCount: input.changedSkus.length,
      emittedEvent: rpcLaneCatalogUpdatedEvent.id,
    };
  })
  .build();

export const rpcLanesShowcaseResource: ResourceWithMeta<
  typeof rpcLanesResource
> = defineResource({
  id: rpcLanesResource.id,
  tags: rpcLanesResource.tags,
  configSchema: rpcLanesResource.configSchema,
  resultSchema: rpcLanesResource.resultSchema,
  dependencies: rpcLanesResource.dependencies,
  context: rpcLanesResource.context,
  init: rpcLanesResource.init,
  middleware: rpcLanesResource.middleware,
  dispose: rpcLanesResource.dispose,
  ready: rpcLanesResource.ready,
  cooldown: rpcLanesResource.cooldown,
  health: rpcLanesResource.health,
  meta: {
    title: "RPC Lanes",
    description:
      "Hosts the catalog RPC lane topology.\n\n- Serves pricing preview and catalog sync\n- Binds each lane to a stub communicator",
  },
});

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

export const eventLanesShowcaseResource: ResourceWithMeta<
  typeof eventLanesResource
> = defineResource({
  id: eventLanesResource.id,
  tags: eventLanesResource.tags,
  configSchema: eventLanesResource.configSchema,
  resultSchema: eventLanesResource.resultSchema,
  dependencies: eventLanesResource.dependencies,
  context: eventLanesResource.context,
  init: eventLanesResource.init,
  middleware: eventLanesResource.middleware,
  dispose: eventLanesResource.dispose,
  ready: eventLanesResource.ready,
  cooldown: eventLanesResource.cooldown,
  health: eventLanesResource.health,
  meta: {
    title: "Event Lanes",
    description:
      "Hosts the catalog event-lane topology.\n\n- Consumes projection update events\n- Binds the lane to a minimal in-memory queue",
  },
});

const eventLanesShowcaseConfig: EventLanesResourceConfig = {
  mode: "network",
  profile: "catalog-events",
  topology: {
    relaySourcePrefix: "runner.event-lanes.relay:",
    bindings: [
      {
        lane: catalogUpdatesEventLane,
        queue: catalogUpdatesQueueResource,
        prefetch: 8,
      },
    ],
    profiles: {
      "catalog-events": {
        consume: [{ lane: catalogUpdatesEventLane }],
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
  catalogProjectionResource,
  catalogProjectionHook,
  rpcLanePricingPreviewTask,
  rpcLaneCatalogSyncTask,
  rpcLanesShowcaseRegistration,
  eventLanesShowcaseRegistration,
];
