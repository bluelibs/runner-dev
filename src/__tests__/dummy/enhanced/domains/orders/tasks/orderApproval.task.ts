import { r } from "@bluelibs/runner";
import {
  DurableOrderApprovalInputSchema,
  DurableOrderApprovalResultSchema,
} from "../../../schemas";
import { orderRepositoryResource } from "../resources/orderRepository.resource";
import {
  durableWorkflowTag,
  showcaseDurableResource,
} from "../resources/orderApprovalRuntime.resource";

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

export const durableOrderApprovalTask = r
  .task("order-approval")
  .meta({
    title: "Order Approval Workflow",
    description:
      "Runs the durable order approval workflow for the reference app.\n\n- Uses `step`, `sleep`, and `note`\n- Looks like a real review pipeline without external dependencies",
  })
  .dependencies({
    durable: showcaseDurableResource,
    orderRepositoryResource,
  })
  .tags([durableWorkflowTag])
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableOrderApprovalResultSchema)
  .run(async (input, { durable, orderRepositoryResource }) => {
    const ctx = durable.use();
    const workflowInput = normalizeDurableOrderApprovalInput(input);

    await ctx.step("load-order", async () =>
      orderRepositoryResource.loadById(workflowInput.orderId)
    );
    const riskScore = await ctx.step("risk-check", async () =>
      computeRiskScore(workflowInput.amount, workflowInput.region)
    );

    const approvalReference = await ctx.step("approve-payment", async () =>
      buildApprovalReference(workflowInput.orderId, riskScore)
    );

    const cooldownMs = 250;
    await ctx.sleep(cooldownMs, { stepId: "partner-cooldown" });
    await ctx.note("Order review completed in reference workflow", {
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
