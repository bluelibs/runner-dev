import type { IResource, IResourceWithConfig } from "@bluelibs/runner";
import { defineResource, RegisterableItems, r } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import type { DurableResource } from "@bluelibs/runner/node";
import {
  DurableExecutionIdResultSchema,
  DurableOrderApprovalInputSchema,
  DurableOrderApprovalResultSchema,
} from "./schemas";

const riskScoreByRegion = {
  US: 3,
  EU: 8,
  APAC: 5,
} as const;

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

type DurableOrderApprovalInput = {
  orderId: string;
  amount: number;
  region: "US" | "EU" | "APAC";
};

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

export const showcaseDurableResource: IResource<
  any,
  Promise<DurableResource>,
  any,
  any,
  { title: string; description: string }
> = defineResource({
  id: "durable-runtime",
  tags: memoryDurableResource.tags,
  configSchema: memoryDurableResource.configSchema,
  resultSchema: memoryDurableResource.resultSchema,
  dependencies: memoryDurableResource.dependencies,
  context: memoryDurableResource.context,
  init: memoryDurableResource.init,
  middleware: memoryDurableResource.middleware,
  dispose: memoryDurableResource.dispose,
  ready: memoryDurableResource.ready,
  cooldown: memoryDurableResource.cooldown,
  health: memoryDurableResource.health,
  meta: {
    title: "Durable Runtime",
    description:
      "Hosts the order approval workflow state.\n\n- Uses the in-memory durable backend\n- Kept intentionally minimal for docs and topology",
  },
});

export const showcaseDurableRegistration: IResourceWithConfig<
  any,
  Promise<DurableResource>
> = showcaseDurableResource.with({});

export const durableOrderApprovalTask = r
  .task("order-approval")
  .meta({
    title: "Order Approval",
    description:
      "Minimal durable approval workflow.\n\n- Uses `step`, `sleep`, and `note`\n- Exists to render a believable workflow shape in docs",
  })
  .dependencies({ durable: showcaseDurableResource })
  .tags([durableWorkflowTag])
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableOrderApprovalResultSchema)
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
  .task("run-order-approval")
  .meta({
    title: "Run Order Approval",
    description:
      "Runs the durable workflow and waits for completion.\n\n- Thin wrapper around `durable.startAndWait(...)`\n- Keeps execution entrypoints explicit in topology",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableOrderApprovalResultSchema)
  .run(async (input, { durable }) => {
    const result = await durable.startAndWait(durableOrderApprovalTask, input);
    return result.data;
  })
  .build();

export const startDurableOrderApprovalTask = r
  .task("start-order-approval")
  .meta({
    title: "Start Order Approval",
    description:
      "Starts the durable workflow and returns the execution id.\n\n- Thin wrapper around `durable.start(...)`\n- Useful to show alternate entrypoints into the same workflow",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableExecutionIdResultSchema)
  .run(async (input, { durable }) => {
    const executionId = await durable.start(durableOrderApprovalTask, input);
    return { executionId };
  })
  .build();

export const durableShowcaseRegistrations: RegisterableItems[] = [
  durableWorkflowTag,
  showcaseDurableRegistration,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
];
