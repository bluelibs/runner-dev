import { globals, r } from "@bluelibs/runner";
import { memoryDurableResource } from "@bluelibs/runner/node";
import { z } from "zod";
import { DURABLE_WORKFLOW_TAG_ID } from "../../../../resources/models/durable.tools";

const tunnelPricingPreviewInputSchema = z.object({
  sku: z.string(),
  basePrice: z.number().positive(),
  region: z.enum(["US", "EU", "APAC"]).default("US"),
});

const tunnelPricingPreviewResultSchema = z.object({
  sku: z.string(),
  adjustedPrice: z.number().positive(),
  ruleApplied: z.string(),
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

const durableOrderApprovalInputSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  region: z.enum(["US", "EU", "APAC"]),
});

const durableOrderApprovalResultSchema = z.object({
  orderId: z.string(),
  status: z.literal("approved"),
  riskScore: z.number().min(0).max(100),
  approvalReference: z.string(),
  cooldownMs: z.number().int().nonnegative(),
});

const durableWorkflowTag = r.tag(DURABLE_WORKFLOW_TAG_ID).build();

export const tunnelCatalogUpdatedEvent = r
  .event("app.examples.tunnel.events.catalogUpdated")
  .meta({
    title: "Catalog Updated",
    description:
      "Emitted by the tunnel showcase sync task after supplier sync.",
  })
  .payloadSchema(z.object({ supplierId: z.string(), updatedAt: z.date() }))
  .build();

export const tunnelPricingPreviewTask = r
  .task("app.examples.tunnel.tasks.pricingPreview")
  .meta({
    title: "Tunnel Pricing Preview",
    description:
      "Simple task that would normally be exposed through a tunnel allow-list.",
  })
  .inputSchema(tunnelPricingPreviewInputSchema)
  .resultSchema(tunnelPricingPreviewResultSchema)
  .run(async (input) => {
    const regionMultiplier =
      input.region === "EU" ? 1.08 : input.region === "APAC" ? 1.04 : 1.02;
    const adjustedPrice = Number(
      (input.basePrice * regionMultiplier).toFixed(2)
    );

    return {
      sku: input.sku,
      adjustedPrice,
      ruleApplied: `regional_multiplier_${input.region.toLowerCase()}`,
      source: "tunnel-exposed-task" as const,
    };
  })
  .build();

export const tunnelCatalogSyncTask = r
  .task("app.examples.tunnel.tasks.catalogSync")
  .meta({
    title: "Tunnel Catalog Sync",
    description:
      "Companion task for the tunnel example that emits an exposed event.",
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
    title: "Tunnel HTTP Exposure (Showcase)",
    description:
      "A minimal server-mode tunnel policy so play can visualize tunnel metadata.",
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

export const showcaseDurableResource = memoryDurableResource.fork(
  "app.examples.durable.runtime"
);

export const showcaseDurableRegistration = showcaseDurableResource.with({});

export const durableOrderApprovalTask = r
  .task("app.examples.durable.tasks.orderApprovalWorkflow")
  .meta({
    title: "Durable Order Approval Workflow",
    description:
      "Durable example with step/sleep/note so the workflow shape is visible in play.",
  })
  .dependencies({ durable: showcaseDurableResource })
  .tags([durableWorkflowTag])
  .inputSchema(durableOrderApprovalInputSchema)
  .resultSchema(durableOrderApprovalResultSchema)
  .run(async (input, { durable }) => {
    const workflowInput = input || {
      orderId: "preview-order",
      amount: 100,
      region: "US" as const,
    };
    const ctx = durable.use();

    const riskScore = await ctx.step("risk-check", async () => {
      const amountScore = Math.min(70, Math.round(workflowInput.amount / 10));
      const regionScore =
        workflowInput.region === "EU"
          ? 8
          : workflowInput.region === "APAC"
          ? 5
          : 3;
      return Math.min(100, amountScore + regionScore);
    });

    const approvalReference = await ctx.step("approve-payment", async () => {
      const suffix = workflowInput.orderId
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-8);
      return `APR-${suffix || "ORDER"}-${riskScore}`;
    });

    const cooldownMs = 250;
    await ctx.sleep(cooldownMs, { stepId: "partner-cooldown" });
    await ctx.note("Order approved in durable showcase flow", {
      orderId: workflowInput.orderId,
      riskScore,
    });

    return {
      orderId: workflowInput.orderId,
      status: "approved" as const,
      riskScore,
      approvalReference,
      cooldownMs,
    };
  })
  .build();

export const runDurableOrderApprovalTask = r
  .task("app.examples.durable.tasks.runOrderApprovalWorkflow")
  .meta({
    title: "Run Durable Order Approval Workflow",
    description:
      "Helper task to execute the durable workflow through durable.execute(...).",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(durableOrderApprovalInputSchema)
  .resultSchema(durableOrderApprovalResultSchema)
  .run(async (input, { durable, durableOrderApprovalTask }) =>
    durable.execute(durableOrderApprovalTask, input)
  )
  .build();

export const tunnelAndDurableExampleRegistrations = [
  tunnelCatalogUpdatedEvent,
  tunnelPricingPreviewTask,
  tunnelCatalogSyncTask,
  tunnelServerShowcaseResource,
  showcaseDurableRegistration,
  durableWorkflowTag,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
];
