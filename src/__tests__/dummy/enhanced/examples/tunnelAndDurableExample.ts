import { globals, r } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import { z } from "zod";

const pricingMultiplierByRegion = {
  US: 1.02,
  EU: 1.08,
  APAC: 1.04,
} as const;

const riskScoreByRegion = {
  US: 3,
  EU: 8,
  APAC: 5,
} as const;

function computeAdjustedPrice(
  basePrice: number,
  region: keyof typeof pricingMultiplierByRegion
): number {
  return Number((basePrice * pricingMultiplierByRegion[region]).toFixed(2));
}

function computeRiskScore(
  amount: number,
  region: keyof typeof riskScoreByRegion
): number {
  const amountScore = Math.min(70, Math.round(amount / 10));
  return Math.min(100, amountScore + riskScoreByRegion[region]);
}

function buildApprovalReference(orderId: string, riskScore: number): string {
  const suffix = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "ORDER";
  return `APR-${suffix}-${riskScore}`;
}

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
type DurableOrderApprovalInput = z.infer<
  typeof durableOrderApprovalInputSchema
>;

function normalizeDurableOrderApprovalInput(
  input: DurableOrderApprovalInput | null | undefined
): DurableOrderApprovalInput {
  const orderId =
    typeof input?.orderId === "string" && input.orderId.trim().length > 0
      ? input.orderId
      : "preview-order";
  const amount =
    typeof input?.amount === "number" && Number.isFinite(input.amount)
      ? Math.max(input.amount, 1)
      : 100;
  const region =
    input?.region === "US" || input?.region === "EU" || input?.region === "APAC"
      ? input.region
      : "US";

  return { orderId, amount, region };
}

const durableOrderApprovalResultSchema = z.object({
  orderId: z.string(),
  status: z.literal("approved"),
  riskScore: z.number().min(0).max(100),
  approvalReference: z.string(),
  cooldownMs: z.number().int().nonnegative(),
});

const durableExecutionIdResultSchema = z.object({
  executionId: z.string(),
});

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
    return {
      sku: input.sku,
      adjustedPrice: computeAdjustedPrice(input.basePrice, input.region),
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
    const ctx = durable.use();
    const workflowInput = normalizeDurableOrderApprovalInput(input);

    const riskScore = await ctx.step("risk-check", async () =>
      computeRiskScore(workflowInput.amount, workflowInput.region)
    );

    const approvalReference = await ctx.step("approve-payment", async () =>
      buildApprovalReference(workflowInput.orderId, riskScore)
    );

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
  .run(async (input, { durable }) =>
    durable.execute(durableOrderApprovalTask, input)
  )
  .build();

export const startDurableOrderApprovalTask = r
  .task("app.examples.durable.tasks.startOrderApprovalWorkflow")
  .meta({
    title: "Start Durable Order Approval Workflow",
    description:
      "Helper task to demonstrate async durable workflow startup via startExecution(...).",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(durableOrderApprovalInputSchema)
  .resultSchema(durableExecutionIdResultSchema)
  .run(async (input, { durable }) => {
    const executionId = await durable.startExecution(
      durableOrderApprovalTask,
      input
    );
    return { executionId };
  })
  .build();

export const tunnelAndDurableExampleRegistrations = [
  tunnelCatalogUpdatedEvent,
  tunnelPricingPreviewTask,
  tunnelCatalogSyncTask,
  tunnelServerShowcaseResource,
  showcaseDurableRegistration,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
];
