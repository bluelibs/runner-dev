import { RegisterableItems, r } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import { z } from "zod";

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

export const showcaseDurableResource = memoryDurableResource.fork(
  "app.examples.durable.runtime"
);

export const showcaseDurableRegistration = showcaseDurableResource.with({});

export const durableOrderApprovalTask = r
  .task("app.examples.durable.tasks.orderApprovalWorkflow")
  .meta({
    title: "Durable Order Approval Workflow",
    description:
      "Durable flow with step/sleep/note so Runner-Dev can render workflow shape.",
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
      "Helper task to execute durable workflow via durable.execute(...).",
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
      "Helper task to start the durable workflow and return execution id.",
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

export const durableShowcaseRegistrations: RegisterableItems[] = [
  showcaseDurableRegistration,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
];
