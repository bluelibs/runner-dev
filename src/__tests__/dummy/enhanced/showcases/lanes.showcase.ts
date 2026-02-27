import { RegisterableItems, r } from "@bluelibs/runner";
import { z } from "zod";

const rpcLaneTag = (laneId: string) => ({
  id: "globals.tags.rpcLane",
  config: { lane: { id: laneId } },
});

const eventLaneTag = (
  laneId: string,
  orderingKey: string,
  metadata: Record<string, unknown>
) => ({
  id: "globals.tags.eventLane",
  config: { lane: { id: laneId }, orderingKey, metadata },
});

const rpcPricingPreviewInputSchema = z.object({
  sku: z.string(),
  basePrice: z.number().positive(),
  region: z.enum(["US", "EU", "APAC"]).default("US"),
});

const rpcPricingPreviewResultSchema = z.object({
  sku: z.string(),
  adjustedPrice: z.number().positive(),
  source: z.literal("rpc-lane-task"),
});

const rpcCatalogSyncInputSchema = z.object({
  supplierId: z.string(),
  changedSkus: z.array(z.string()).min(1),
});

const rpcCatalogSyncResultSchema = z.object({
  supplierId: z.string(),
  syncedCount: z.number().int().nonnegative(),
  emittedEvent: z.string(),
});

export const rpcLaneCatalogUpdatedEvent = r
  .event("app.examples.lanes.events.catalogUpdated")
  .meta({
    title: "RPC Lane Catalog Updated",
    description: "RPC lane tagged showcase event.",
  })
  .tags([rpcLaneTag("app.examples.lanes.rpc.catalog-updates")])
  .payloadSchema(
    z.object({
      supplierId: z.string(),
      updatedAt: z.date(),
    })
  )
  .build();

export const eventLaneCatalogProjectionUpdatedEvent = r
  .event("app.examples.lanes.events.catalogProjectionUpdated")
  .meta({
    title: "Event Lane Catalog Projection Updated",
    description: "Event lane tagged showcase event.",
  })
  .tags([
    eventLaneTag("app.examples.lanes.event.catalog-updates", "supplierId", {
      domain: "catalog",
    }),
  ])
  .payloadSchema(
    z.object({
      supplierId: z.string(),
      projectedAt: z.date(),
    })
  )
  .build();

export const rpcLanePricingPreviewTask = r
  .task("app.examples.lanes.tasks.pricingPreview")
  .meta({
    title: "RPC Lane Pricing Preview",
    description: "Task tagged with globals.tags.rpcLane.",
  })
  .tags([rpcLaneTag("app.examples.lanes.rpc.pricing-preview")])
  .inputSchema(rpcPricingPreviewInputSchema)
  .resultSchema(rpcPricingPreviewResultSchema)
  .run(async (input) => ({
    sku: input.sku,
    adjustedPrice: Number((input.basePrice * 1.03).toFixed(2)),
    source: "rpc-lane-task" as const,
  }))
  .build();

export const rpcLaneCatalogSyncTask = r
  .task("app.examples.lanes.tasks.catalogSync")
  .meta({
    title: "RPC Lane Catalog Sync",
    description:
      "Companion rpc-lane task that emits the lane-tagged catalog updated event.",
  })
  .tags([rpcLaneTag("app.examples.lanes.rpc.catalog-sync")])
  .dependencies({
    emitCatalogUpdated: rpcLaneCatalogUpdatedEvent,
  })
  .inputSchema(rpcCatalogSyncInputSchema)
  .resultSchema(rpcCatalogSyncResultSchema)
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

export const rpcLanesShowcaseResource = r
  .resource("platform.node.resources.rpcLanes")
  .meta({
    title: "RPC Lanes Showcase Resource",
    description: "Resource config used by Runner-Dev RPC lanes section.",
  })
  .tags([{ id: "globals.tags.rpcLanes" }])
  .build();

export const rpcLanesShowcaseRegistration = rpcLanesShowcaseResource.with({
  mode: "service",
  profile: "catalog",
  topology: {
    bindings: [
      {
        lane: { id: "app.examples.lanes.rpc.pricing-preview" },
        communicator: { id: "app.examples.communicators.pricing" },
      },
      {
        lane: { id: "app.examples.lanes.rpc.catalog-sync" },
        communicator: { id: "app.examples.communicators.catalog-sync" },
      },
      {
        lane: { id: "app.examples.lanes.rpc.catalog-updates" },
        communicator: { id: "app.examples.communicators.catalog-events" },
      },
    ],
    profiles: {
      catalog: {
        serve: [
          { id: "app.examples.lanes.rpc.pricing-preview" },
          { id: "app.examples.lanes.rpc.catalog-sync" },
          { id: "app.examples.lanes.rpc.catalog-updates" },
        ],
      },
    },
  },
});

export const eventLanesShowcaseResource = r
  .resource("globals.resources.node.eventLanes")
  .meta({
    title: "Event Lanes Showcase Resource",
    description: "Resource config used by Runner-Dev event lanes section.",
  })
  .build();

export const eventLanesShowcaseRegistration = eventLanesShowcaseResource.with({
  mode: "consumer",
  profile: "catalog-events",
  topology: {
    relaySourcePrefix: "runner.event-lanes.relay:",
    bindings: [
      {
        lane: { id: "app.examples.lanes.event.catalog-updates" },
        queue: { id: "app.examples.queues.catalog-updates" },
        prefetch: 8,
      },
    ],
    profiles: {
      "catalog-events": {
        consume: [{ id: "app.examples.lanes.event.catalog-updates" }],
      },
    },
  },
});

export const lanesShowcaseRegistrations: RegisterableItems[] = [
  rpcLaneCatalogUpdatedEvent,
  eventLaneCatalogProjectionUpdatedEvent,
  rpcLanePricingPreviewTask,
  rpcLaneCatalogSyncTask,
  rpcLanesShowcaseRegistration,
  eventLanesShowcaseRegistration,
];
