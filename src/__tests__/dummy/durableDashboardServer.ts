import { r, run } from "@bluelibs/runner";
import {
  durableSupportResource,
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import { z } from "zod";
import { dev } from "../../resources/dev.resource";
import { serverResource } from "../../resources/server.resource";
import { once } from "node:events";

const durable = memoryDurableResource.fork("operations-runtime");
const approval = r
  .event("approval")
  .meta({ title: "Approval decision" })
  .payloadSchema(z.object({ approved: z.boolean(), reviewer: z.string() }))
  .build();
const inputSchema = z.object({
  reference: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(["complete", "approval", "sleep", "fail"]).default("approval"),
});

function workflow(key: string, title: string, category: string) {
  return r
    .task(key)
    .meta({
      title,
      description: `Durable ${title.toLowerCase()} with validation, approval and settlement.`,
    })
    .dependencies({ durable })
    .tags([
      durableWorkflowTag.with({
        key,
        category,
        ...(key === "invoice-reconciliation" ? {} : { signals: [approval] }),
        metadata: {
          studio: {
            presets: [
              {
                name: "Await approval",
                payload: {
                  reference: "ORD-2048",
                  amount: 2450,
                  mode: "approval",
                },
              },
              {
                name: "Complete immediately",
                payload: {
                  reference: "ORD-2049",
                  amount: 120,
                  mode: "complete",
                },
              },
            ],
          },
        },
      }),
    ])
    .inputSchema(inputSchema)
    .run(async (input, { durable }) => {
      const ctx = durable.use();
      await ctx.step("validate-request", async () => ({
        reference: input.reference,
        valid: true,
      }));
      const risk = await ctx.step("assess-risk", async () => ({
        score: Math.min(100, Math.round(input.amount / 100)),
        amount: input.amount,
      }));
      if (input.mode === "fail")
        await ctx.step("authorize-payment", async () => {
          throw new Error(
            "Payment authorization declined. Review the payment provider response."
          );
        });
      if (input.mode === "approval")
        await ctx.waitForSignal(approval, { stepId: "review-approval" });
      if (input.mode === "sleep")
        await ctx.sleep(1_200_000, { stepId: "partner-settlement" });
      const receipt = await ctx.step("settle", async () => ({
        reference: input.reference,
        receipt: `RCPT-${input.reference}`,
        risk,
      }));
      await ctx.note("Processing completed", { reference: input.reference });
      return receipt;
    })
    .build();
}
const workflows = [
  workflow("order-processing", "Order processing", "Commerce"),
  workflow("customer-onboarding", "Customer onboarding", "Customers"),
  workflow("invoice-reconciliation", "Invoice reconciliation", "Finance"),
  workflow("partner-settlement", "Partner settlement", "Finance"),
];
const app = r
  .resource("durable-preview")
  .meta({ title: "Operations Platform" })
  .register([
    durableSupportResource,
    durable.with({
      audit: { enabled: true },
      execution: { maxAttempts: 1 },
      polling: { interval: 100 },
    }),
    approval,
    ...workflows,
    dev.with({ port: 31339 }),
  ])
  .build();

async function main() {
  const runtime = await run(app, { logs: { printThreshold: null } });
  const server = runtime.getResourceValue(serverResource);
  if (!server.httpServer.listening) await once(server.httpServer, "listening");
  const service = runtime.getResourceValue(durable);
  for (let index = 0; index < 24; index++) {
    const mode =
      index % 7 === 0
        ? "fail"
        : index % 5 === 0
        ? "sleep"
        : index % 3 === 0
        ? "approval"
        : "complete";
    await service.start(
      workflows[index % workflows.length],
      inputSchema.parse({
        reference: `ORD-${2048 + index}`,
        amount: 100 + index * 145,
        mode,
      })
    );
  }
  await service.schedule(
    workflows[2],
    inputSchema.parse({ reference: "INV-3301", amount: 820, mode: "complete" }),
    { interval: 300_000 }
  );
  console.log("Durable preview: http://localhost:31339/durable");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
