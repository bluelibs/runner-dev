import { r, run } from "@bluelibs/runner";
import {
  durableSupportResource,
  durableWorkflowTag,
  memoryDurableResource,
  sqliteDurableResource,
} from "@bluelibs/runner/node";
import { once } from "node:events";
import { z } from "zod";
import { dev } from "../../resources/dev.resource";
import { serverResource } from "../../resources/server.resource";

const port = Number(process.env.PORT ?? 31339);

const sqliteDurable = sqliteDurableResource.fork("operations-sqlite");
const financeDurable = memoryDurableResource.fork("finance-memory");

const approval = r
  .event("approval")
  .meta({ title: "Approval decision" })
  .payloadSchema(z.object({ approved: z.boolean(), reviewer: z.string() }))
  .build();

const orderInputSchema = z.object({
  reference: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(["complete", "approval", "sleep", "fail"]).default("approval"),
  city: z.string().min(1).default("Bucharest"),
  spawnShipment: z.boolean().default(false),
});

const auditInputSchema = z.object({
  checkId: z.string().min(1),
  scope: z.string().default("daily-ledger"),
});

const financeInputSchema = z.object({
  reference: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(["complete", "approval", "sleep", "fail"]).default("complete"),
});

const updateShippingAddress = r
  .task("update-shipping-address")
  .meta({
    title: "Update shipping address",
    description: "Update destination city and shipping speed on a live order.",
  })
  .dependencies({ sqliteDurable })
  .inputSchema(
    z.object({
      city: z.string().min(1),
      expedited: z.boolean().default(false),
    })
  )
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    await ctx.setState({
      shippingCity: input.city,
      expedited: input.expedited,
    });
    return { updated: true, city: input.city, expedited: input.expedited };
  })
  .build();

const addOperatorNote = r
  .task("add-operator-note")
  .meta({
    title: "Add operator note",
    description: "Attach an operator review note to workflow state.",
  })
  .dependencies({ sqliteDurable })
  .inputSchema(z.object({ note: z.string().min(1) }))
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    await ctx.setState({ lastOperatorNote: input.note });
    return { recorded: true, note: input.note };
  })
  .build();

const fulfillShipment = r
  .task("fulfill-shipment")
  .meta({
    title: "Fulfill shipment",
    description: "Allocate a carrier and dispatch a fulfilled order.",
  })
  .dependencies({ sqliteDurable })
  .tags([
    durableWorkflowTag.with({
      key: "fulfill-shipment",
      version: 1,
      category: "Logistics",
    }),
  ])
  .inputSchema(z.object({ reference: z.string().min(1), city: z.string() }))
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    await ctx.step("allocate-carrier", async () => ({
      carrier: "BlueExpress",
      hub: input.city,
    }));
    return await ctx.step("dispatch-parcel", async () => ({
      trackingNumber: `TRK-${input.reference}`,
      city: input.city,
    }));
  })
  .build();

const orderProcessingV1 = r
  .task("order-processing-v1")
  .meta({
    title: "Order processing",
    description: "Legacy v1 order workflow with basic approval and settlement.",
  })
  .dependencies({ sqliteDurable })
  .tags([
    durableWorkflowTag.with({
      key: "order-processing",
      version: 1,
      category: "Commerce",
      signals: [approval],
      metadata: {
        studio: {
          presets: [
            {
              name: "Legacy v1 order",
              payload: {
                reference: "ORD-1001",
                amount: 640,
                mode: "complete",
                city: "Bucharest",
                spawnShipment: false,
              },
            },
          ],
        },
      },
    }),
  ])
  .inputSchema(orderInputSchema)
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    await ctx.step("validate-request", async () => ({
      reference: input.reference,
      version: 1,
      valid: true,
    }));
    if (input.mode === "approval") {
      await ctx.waitForSignal(approval, { stepId: "review-approval" });
    }
    return await ctx.step("settle", async () => ({
      reference: input.reference,
      receipt: `RCPT-V1-${input.reference}`,
    }));
  })
  .build();

const orderProcessingV2 = r
  .task("order-processing-v2")
  .meta({
    title: "Order processing",
    description:
      "Durable order fulfillment with typed state, live operator commands, child shipment and checkpoint recovery.",
  })
  .dependencies({ sqliteDurable })
  .tags([
    durableWorkflowTag.with({
      key: "order-processing",
      version: 2,
      category: "Commerce",
      signals: [approval],
      commands: [updateShippingAddress, addOperatorNote],
      concurrency: 8,
      retention: {
        onComplete: { afterMs: 86_400_000 },
        receipts: { afterMs: 604_800_000 },
      },
      metadata: {
        studio: {
          presets: [
            {
              name: "Await approval (v2)",
              payload: {
                reference: "ORD-2048",
                amount: 2450,
                mode: "approval",
                city: "Bucharest",
                spawnShipment: false,
              },
            },
            {
              name: "Complete with shipment",
              payload: {
                reference: "ORD-2049",
                amount: 980,
                mode: "complete",
                city: "Cluj-Napoca",
                spawnShipment: true,
              },
            },
            {
              name: "Trigger payment failure",
              payload: {
                reference: "ORD-2050",
                amount: 4200,
                mode: "fail",
                city: "Berlin",
                spawnShipment: false,
              },
            },
          ],
        },
      },
    }),
  ])
  .inputSchema(orderInputSchema)
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    await ctx.replaceState({
      reference: input.reference,
      stage: "validated",
      shippingCity: input.city,
      expedited: false,
    });
    await ctx.step("validate-request", async () => ({
      reference: input.reference,
      city: input.city,
      valid: true,
    }));
    const risk = await ctx.step("assess-risk", async () => ({
      score: Math.min(100, Math.round(input.amount / 100)),
      amount: input.amount,
    }));
    await ctx.setState({ stage: "risk-assessed", riskScore: risk.score });
    if (input.mode === "fail") {
      await ctx.step("authorize-payment", async () => {
        throw new Error(
          "Payment authorization declined. Review the payment provider response."
        );
      });
    }
    if (input.mode === "approval") {
      await ctx.waitForSignal(approval, { stepId: "review-approval" });
    }
    if (input.mode === "sleep") {
      await ctx.sleep(1_200_000, { stepId: "partner-settlement" });
    }
    let shipment: unknown = null;
    if (input.spawnShipment) {
      const childId = await ctx.workflow("start-shipment", fulfillShipment, {
        reference: input.reference,
        city: input.city,
      });
      const waited = await ctx.waitForExecution(fulfillShipment, childId, {
        timeoutMs: 30_000,
      });
      shipment = waited.kind === "completed" ? waited.data : null;
    }
    const receipt = await ctx.step("settle", async () => ({
      reference: input.reference,
      receipt: `RCPT-${input.reference}`,
      risk,
      ...(shipment ? { shipment } : {}),
    }));
    await ctx.setState({ stage: "settled" });
    await ctx.note("Processing completed", { reference: input.reference });
    return receipt;
  })
  .build();

const quickAuditCheck = r
  .task("quick-audit-check")
  .meta({
    title: "Quick audit check",
    description:
      "Fast compliance verification whose step history is collected on completion while retaining the receipt.",
  })
  .dependencies({ sqliteDurable })
  .tags([
    durableWorkflowTag.with({
      key: "quick-audit-check",
      version: 1,
      category: "Compliance",
      retention: {
        onComplete: "delete",
        receipts: { afterMs: 86_400_000 },
      },
      metadata: {
        studio: {
          presets: [
            {
              name: "Daily ledger check",
              payload: { checkId: "CHK-9010", scope: "daily-ledger" },
            },
          ],
        },
      },
    }),
  ])
  .inputSchema(auditInputSchema)
  .run(async (input, { sqliteDurable }) => {
    const ctx = sqliteDurable.use();
    return await ctx.step("verify-checksum", async () => ({
      checkId: input.checkId,
      scope: input.scope,
      passed: true,
    }));
  })
  .build();

function financeWorkflow(key: string, title: string) {
  return r
    .task(key)
    .meta({
      title,
      description: `Finance ${title.toLowerCase()} backed by the in-memory durable store.`,
    })
    .dependencies({ financeDurable })
    .tags([
      durableWorkflowTag.with({
        key,
        category: "Finance",
        ...(key === "partner-settlement" ? { signals: [approval] } : {}),
        metadata: {
          studio: {
            presets: [
              {
                name: "Standard reconciliation",
                payload: {
                  reference: "INV-3301",
                  amount: 820,
                  mode: "complete",
                },
              },
            ],
          },
        },
      }),
    ])
    .inputSchema(financeInputSchema)
    .run(async (input, { financeDurable }) => {
      const ctx = financeDurable.use();
      await ctx.step("load-ledger", async () => ({
        reference: input.reference,
        amount: input.amount,
      }));
      if (input.mode === "approval") {
        await ctx.waitForSignal(approval, { stepId: "review-approval" });
      }
      return await ctx.step("finalize-batch", async () => ({
        reference: input.reference,
        settled: true,
      }));
    })
    .build();
}

const financeWorkflows = [
  financeWorkflow("invoice-reconciliation", "Invoice reconciliation"),
  financeWorkflow("partner-settlement", "Partner settlement"),
];

const app = r
  .resource("durable-preview")
  .meta({ title: "Operations Platform" })
  .register([
    durableSupportResource,
    sqliteDurable.with({
      persist: { filename: ":memory:" },
      audit: { enabled: true },
      execution: { maxAttempts: 1 },
      timers: { pollIntervalMs: 100 },
      garbageCollection: { enabled: false },
    }),
    financeDurable.with({
      audit: { enabled: true },
      execution: { maxAttempts: 1 },
      timers: { pollIntervalMs: 100 },
    }),
    approval,
    updateShippingAddress,
    addOperatorNote,
    fulfillShipment,
    orderProcessingV1,
    orderProcessingV2,
    quickAuditCheck,
    ...financeWorkflows,
    dev.with({ port }),
  ])
  .build();

async function waitUntil(
  check: () => Promise<boolean>,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("Timed out waiting for preview seed state.");
}

async function main() {
  const runtime = await run(app, { logs: { printThreshold: null } });
  const server = runtime.getResourceValue(serverResource);
  if (!server.httpServer.listening) await once(server.httpServer, "listening");

  const sqliteService = runtime.getResourceValue(sqliteDurable);
  const financeService = runtime.getResourceValue(financeDurable);
  const sqliteStore = sqliteService.getStore();

  const waitForTerminal = async (
    service: typeof sqliteService,
    executionId: string
  ) => {
    await waitUntil(async () => {
      const detail = await service.operator.getExecutionDetail(executionId);
      return ["completed", "failed", "cancelled"].includes(
        detail.execution?.status ?? ""
      );
    });
  };

  const waitForWaiting = async (
    service: typeof sqliteService,
    executionId: string,
    kind: "waitForSignal" | "sleep"
  ) => {
    await waitUntil(async () => {
      const detail = await service.operator.getExecutionDetail(executionId);
      const leased = await service.getStore().hasExecutionLease?.(executionId);
      return detail.execution?.current?.kind === kind && !leased;
    });
  };

  // 1. Legacy v1 completed execution
  const v1OrderId = await sqliteService.start(
    orderProcessingV1,
    orderInputSchema.parse({
      reference: "ORD-1001",
      amount: 640,
      mode: "complete",
    })
  );
  await waitForTerminal(sqliteService, v1OrderId);

  // 2. Completed v2 execution with child shipment workflow
  const shipmentOrderId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2049",
      amount: 980,
      mode: "complete",
      city: "Cluj-Napoca",
      spawnShipment: true,
    })
  );
  await waitForTerminal(sqliteService, shipmentOrderId);

  // 3. Completed v2 execution + checkpoint-reset branch before `settle`
  const branchSourceId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2052",
      amount: 1550,
      mode: "complete",
      city: "Timisoara",
    })
  );
  await waitForTerminal(sqliteService, branchSourceId);
  const branchOrderId = await sqliteService.operator.reset(branchSourceId, {
    beforeStep: "settle",
    reason: "Re-run settlement after payment gateway hotfix",
  });
  await waitForTerminal(sqliteService, branchOrderId);

  // 4. Live v2 order waiting for approval with a completed tracked command + live state
  const liveOrderId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2048",
      amount: 2450,
      mode: "approval",
      city: "Bucharest",
    })
  );
  await waitForWaiting(sqliteService, liveOrderId, "waitForSignal");
  await sqliteService.command(
    liveOrderId,
    updateShippingAddress,
    { city: "Vienna", expedited: true },
    { idempotencyKey: "seed-address-update" }
  );

  // 5. Paused v2 order ready for checkpoint branching
  const pausedOrderId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2051",
      amount: 1890,
      mode: "approval",
      city: "Bucharest",
    })
  );
  await waitForWaiting(sqliteService, pausedOrderId, "waitForSignal");
  await sqliteService.pauseExecution(pausedOrderId);

  // 6. Sleeping and failed v2 orders
  const sleepingOrderId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2053",
      amount: 720,
      mode: "sleep",
      city: "Iasi",
    })
  );
  await waitForWaiting(sqliteService, sleepingOrderId, "sleep");

  const failedOrderId = await sqliteService.start(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-2054",
      amount: 4200,
      mode: "fail",
      city: "Berlin",
    })
  );
  await waitForTerminal(sqliteService, failedOrderId);

  // 7. Two-stage retention check with history collected
  const collectedCheckId = await sqliteService.start(
    quickAuditCheck,
    auditInputSchema.parse({ checkId: "CHK-9001", scope: "daily-ledger" })
  );
  await waitForTerminal(sqliteService, collectedCheckId);
  await sqliteStore.collectCompletedHistory?.(
    new Date(Date.now() + 60_000),
    50
  );

  // 8. Versioned SQLite schedules
  await sqliteService.schedule(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-SCHED-1",
      amount: 500,
      mode: "complete",
      city: "Bucharest",
    }),
    { interval: 300_000 }
  );
  await sqliteService.schedule(
    orderProcessingV2,
    orderInputSchema.parse({
      reference: "ORD-CRON-1",
      amount: 750,
      mode: "complete",
      city: "Cluj-Napoca",
    }),
    { cron: "*/15 * * * *" }
  );

  // 9. Second runtime (`finance-memory`) so runtime selector displays both SQLite and Memory backends
  const fin1 = await financeService.start(
    financeWorkflows[0],
    financeInputSchema.parse({
      reference: "INV-3301",
      amount: 820,
      mode: "complete",
    })
  );
  const fin2 = await financeService.start(
    financeWorkflows[1],
    financeInputSchema.parse({
      reference: "STL-4402",
      amount: 1640,
      mode: "approval",
    })
  );
  await waitForTerminal(financeService, fin1);
  await waitForWaiting(financeService, fin2, "waitForSignal");
  await financeService.schedule(
    financeWorkflows[0],
    financeInputSchema.parse({
      reference: "INV-3302",
      amount: 940,
      mode: "complete",
    }),
    { interval: 600_000 }
  );

  console.log(`Durable preview: http://localhost:${port}/durable`);
  console.log(
    JSON.stringify({
      liveOrderId,
      pausedOrderId,
      branchOrderId,
      collectedCheckId,
      shipmentOrderId,
      failedOrderId,
    })
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
