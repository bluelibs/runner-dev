import { globals, RegisterableItems, r } from "@bluelibs/runner";
import { z } from "zod";

const tunnelPricingPreviewInputSchema = z.object({
  sku: z.string(),
  basePrice: z.number().positive(),
  region: z.enum(["US", "EU", "APAC"]).default("US"),
});

const tunnelPricingPreviewResultSchema = z.object({
  sku: z.string(),
  adjustedPrice: z.number().positive(),
  source: z.literal("tunnel-exposed-task"),
});

const tunnelCatalogSyncInputSchema = z.object({
  supplierId: z.string(),
  changedSkus: z.array(z.string()).min(1),
});

const tunnelCatalogSyncResultSchema = z.object({
  supplierId: z.string(),
  syncedCount: z.number().int().nonnegative(),
  emittedEvent: z.string(),
});

export const tunnelCatalogUpdatedEvent = r
  .event("app.examples.tunnel.events.catalogUpdated")
  .meta({
    title: "Tunnel Catalog Updated",
    description: "Event emitted by the tunnel catalog sync showcase task.",
  })
  .payloadSchema(
    z.object({
      supplierId: z.string(),
      updatedAt: z.date(),
    })
  )
  .build();

export const tunnelPricingPreviewTask = r
  .task("app.examples.tunnel.tasks.pricingPreview")
  .meta({
    title: "Tunnel Pricing Preview",
    description: "Minimal task included in tunnel exposure metadata.",
  })
  .inputSchema(tunnelPricingPreviewInputSchema)
  .resultSchema(tunnelPricingPreviewResultSchema)
  .run(async (input) => ({
    sku: input.sku,
    adjustedPrice: Number((input.basePrice * 1.03).toFixed(2)),
    source: "tunnel-exposed-task" as const,
  }))
  .build();

export const tunnelCatalogSyncTask = r
  .task("app.examples.tunnel.tasks.catalogSync")
  .meta({
    title: "Tunnel Catalog Sync",
    description:
      "Companion task for tunnel metadata that emits the catalog updated event.",
  })
  .dependencies({
    emitCatalogUpdated: tunnelCatalogUpdatedEvent,
  })
  .inputSchema(tunnelCatalogSyncInputSchema)
  .resultSchema(tunnelCatalogSyncResultSchema)
  .run(async (input, { emitCatalogUpdated }) => {
    await emitCatalogUpdated({
      supplierId: input.supplierId,
      updatedAt: new Date(),
    });

    return {
      supplierId: input.supplierId,
      syncedCount: input.changedSkus.length,
      emittedEvent: tunnelCatalogUpdatedEvent.id,
    };
  })
  .build();

export const tunnelServerShowcaseResource = r
  .resource("app.examples.tunnel.resources.httpExposure")
  .meta({
    title: "Tunnel HTTP Exposure Showcase",
    description:
      "Server-style tunnel metadata so Runner-Dev can render tunnel cards and routes.",
  })
  .tags([globals.tags.tunnel])
  .init(async () => ({
    mode: "server" as const,
    transport: "http" as const,
    tasks: [tunnelPricingPreviewTask.id, tunnelCatalogSyncTask.id],
    events: [tunnelCatalogUpdatedEvent.id],
    endpoint: "http://localhost:31337/__runner",
    auth: "token",
  }))
  .build();

export const tunnelShowcaseRegistrations: RegisterableItems[] = [
  tunnelCatalogUpdatedEvent,
  tunnelPricingPreviewTask,
  tunnelCatalogSyncTask,
  tunnelServerShowcaseResource,
];
