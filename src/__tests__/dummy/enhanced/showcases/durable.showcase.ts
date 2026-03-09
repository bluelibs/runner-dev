import type { IResource, IResourceWithConfig } from "@bluelibs/runner";
import { RegisterableItems, r } from "@bluelibs/runner";
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
  Promise<DurableResource>
> = memoryDurableResource.fork("durable-runtime");

export const showcaseDurableRegistration: IResourceWithConfig<
  any,
  Promise<DurableResource>
> = showcaseDurableResource.with({});

export const durableOrderApprovalTask = r
  .task("order-approval")
  .meta({
    title: "Durable Order Approval Workflow",
    description:
      "Durable flow with step/sleep/note so Runner-Dev can render workflow shape.",
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
    title: "Run Durable Order Approval Workflow",
    description:
      "Helper task to execute durable workflow via durable.execute(...).",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableOrderApprovalResultSchema)
  .run(async (input, { durable }) =>
    durable.execute(durableOrderApprovalTask, input)
  )
  .build();

export const startDurableOrderApprovalTask = r
  .task("start-order-approval")
  .meta({
    title: "Start Durable Order Approval Workflow",
    description:
      "Helper task to start the durable workflow and return execution id.",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableExecutionIdResultSchema)
  .run(async (input, { durable }) => {
    const executionId = await durable.startExecution(
      durableOrderApprovalTask,
      input
    );
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
