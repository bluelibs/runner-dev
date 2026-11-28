import {
  defineEvent,
  defineResource,
  defineTask,
  resources,
  run,
} from "@bluelibs/runner";
import {
  ExecutionStatus,
  durableSupportResource,
  durableWorkflowTag,
  sqliteDurableResource,
} from "@bluelibs/runner/node";
import express from "express";
import { once } from "node:events";
import request from "supertest";
import z from "zod";
import { createDurableRouter } from "../../durable/router";
import { createHttpPasswordGuard } from "../../resources/routeHandlers/httpPasswordGuard";
import { fixture, close } from "./durable.dashboard.fixtures";

describe("Durable dashboard generic application integration", () => {
  let testApp: Awaited<ReturnType<typeof fixture>>;
  let leftId: string;
  let rightId: string;
  beforeAll(async () => {
    testApp = await fixture();
    const response = await testApp.get("/runtimes");
    leftId = response.body.runtimes.find((entry: { id: string }) =>
      entry.id.endsWith(".left")
    ).id;
    rightId = response.body.runtimes.find((entry: { id: string }) =>
      entry.id.endsWith(".right")
    ).id;
  });
  afterAll(async () => {
    await close(testApp.server);
    await testApp.runtime.dispose();
  });

  test("shares HTTP authentication and requires runtime selection", async () => {
    expect(
      (await testApp.client.get(testApp.prefix + "/runtimes")).status
    ).toBe(401);
    expect((await testApp.get("/executions")).status).toBe(400);
    expect((await testApp.get("/executions?runtimeId=missing")).status).toBe(
      404
    );
    const runtimes = (await testApp.get("/runtimes")).body.runtimes;
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0].backend).toBe("memory");
    expect(runtimes[0].capabilities).toEqual({
      pause: true,
      resume: true,
      restart: true,
      state: true,
      command: true,
      reset: true,
      replay: true,
    });
  });

  test("catalog ownership and metadata are isolated by actual runtime dependency", async () => {
    const left = await testApp.get(`/workflows?runtimeId=${leftId}`);
    const right = await testApp.get(`/workflows?runtimeId=${rightId}`);
    expect(left.status).toBe(200);
    expect(
      left.body.workflows.map((entry: { key: string }) => entry.key)
    ).toEqual(["leftFlow"]);
    expect(
      right.body.workflows.map((entry: { key: string }) => entry.key)
    ).toEqual(["rightFlow"]);
    expect(left.body.workflows[0].signals[0].id).toBe("approved");
    expect(left.body.workflows[0].presets[0].name).toBe("Example");
    expect(
      (
        await testApp.post(`/executions?runtimeId=${leftId}`, {
          workflow: "rightFlow",
          input: { name: "Ada" },
        })
      ).status
    ).toBe(404);
    expect(
      (await testApp.get(`/workflows?runtimeId=${leftId}&limit=0`)).status
    ).toBe(400);
  });

  test("lists routed event and workflow definitions before execution, with per-runtime metadata and description search", async () => {
    const right = await testApp.get(
      `/catalog?runtimeId=${rightId}&query=settlement`
    );
    expect(right.status).toBe(200);
    expect(right.body).toMatchObject({
      total: 2,
      entries: [
        {
          kind: "Durable event",
          key: "receipt-issued",
          description: "Deliver the receipt after settlement.",
        },
      ],
    });
    const left = await testApp.get(`/catalog?runtimeId=${leftId}`);
    expect(left.body.entries).toEqual([
      expect.objectContaining({
        kind: "Durable event",
        key: expect.stringContaining("approved"),
      }),
      expect.objectContaining({ kind: "Workflow", key: "leftFlow" }),
    ]);
  });

  test("starts real runs, cursor lists, observed steps and detail never cross runtimes", async () => {
    const response = await testApp.post(`/executions?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Ada", wait: false },
    });
    expect(response.status).toBe(201);
    const id = response.body.executionId;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const detail = await testApp.get(`/executions/${id}?runtimeId=${leftId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.execution.input.name).toBe("Ada");
    expect(
      detail.body.execution.timeline.map((node: { id: string }) => node.id)
    ).toContain("name");
    expect(detail.body.execution.audit.length).toBeGreaterThan(0);
    expect(detail.body.execution.state).toBeNull();
    const list = await testApp.get(
      `/executions?runtimeId=${leftId}&executionId=${id}&limit=1`
    );
    expect(
      list.body.executions.map((entry: { id: string }) => entry.id)
    ).toEqual([id]);
    expect(list.body.executions[0]).not.toHaveProperty("input");
    expect(
      (await testApp.get(`/executions/${id}?runtimeId=${rightId}`)).status
    ).toBe(404);
    expect(
      (await testApp.post(`/executions/${id}/cancel?runtimeId=${rightId}`))
        .status
    ).toBe(404);
    expect(
      (await testApp.post(`/executions/${id}/pause?runtimeId=${leftId}`)).status
    ).toBe(409);
    expect(
      (
        await testApp.post(`/executions?runtimeId=${leftId}`, {
          workflow: "leftFlow",
          input: { name: "" },
        })
      ).status
    ).toBe(400);
    expect(
      (await testApp.get(`/executions?runtimeId=${leftId}&status=unknown`))
        .status
    ).toBe(400);
  });

  test("resolves registered signal schema and delivers to the real workflow", async () => {
    const response = await testApp.post(`/executions?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Grace", wait: true },
    });
    const id = response.body.executionId;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const signalPath = `/executions/${id}/signals?runtimeId=${leftId}`;
    expect(
      (
        await testApp.post(signalPath, {
          signal: "approved",
          payload: { approved: "yes" },
        })
      ).status
    ).toBe(400);
    expect(
      (await testApp.post(signalPath, { signal: "missing", payload: {} }))
        .status
    ).toBe(400);
    expect(
      (
        await testApp.post(signalPath, {
          signal: "approved",
          payload: { approved: true },
        })
      ).status
    ).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const detail = (await testApp.get(`/executions/${id}?runtimeId=${leftId}`))
      .body.execution;
    expect(detail.status).toBe("completed");
    expect(detail.result.payload.approved).toBe(true);
    expect(detail.signals[0].history[0].payload.approved).toBe(true);
  });

  test("lists application-owned schedules and operates them only on their runtime", async () => {
    const response = await testApp.post(`/schedules?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Schedule", wait: false },
      interval: 600000,
    });
    expect(response.status).toBe(405);
    const id = await testApp.seedSchedule("daily", 600000, "Schedule");
    expect(
      (await testApp.get(`/schedules?runtimeId=${leftId}`)).body.schedules
    ).toHaveLength(1);
    expect(
      (await testApp.get(`/schedules?runtimeId=${rightId}`)).body.schedules
    ).toHaveLength(0);
    expect(
      (await testApp.post(`/schedules/${id}/pause?runtimeId=${rightId}`)).status
    ).toBe(404);
    expect(
      (await testApp.post(`/schedules/${id}/pause?runtimeId=${leftId}`)).status
    ).toBe(200);
    expect(
      (await testApp.post(`/schedules/${id}/resume?runtimeId=${leftId}`)).status
    ).toBe(200);
    const preview = await testApp.post(
      `/schedules/preview?runtimeId=${leftId}`,
      { interval: 1000 }
    );
    expect(preview.body.fires).toHaveLength(5);
    expect(
      (
        await testApp.post(`/schedules/preview?runtimeId=${leftId}`, {
          cron: "invalid",
        })
      ).status
    ).toBe(400);
    expect(
      (
        await testApp.post(`/schedules/preview?runtimeId=${leftId}`, {
          interval: 1000,
          delay: 1000,
        })
      ).status
    ).toBe(400);
    const updated = await testApp.client
      .patch(`${testApp.prefix}/schedules/${id}?runtimeId=${leftId}`)
      .set("Authorization", testApp.auth)
      .send({ interval: 900000 });
    expect(updated.status).toBe(200);
    const removed = await testApp.client
      .delete(`${testApp.prefix}/schedules/${id}?runtimeId=${leftId}`)
      .set("Authorization", testApp.auth);
    expect(removed.status).toBe(200);
  });

  test("rejects retry after cancellation without resetting the terminal record", async () => {
    const started = await testApp.post(`/executions?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Cancel", wait: true },
    });
    const id = started.body.executionId;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(
      (await testApp.post(`/executions/${id}/cancel?runtimeId=${leftId}`))
        .status
    ).toBe(202);
    const retried = await testApp.post(
      `/executions/${id}/retry?runtimeId=${leftId}`
    );
    expect(retried.status).toBe(409);
    const detail = await testApp.get(`/executions/${id}?runtimeId=${leftId}`);
    expect(detail.body.execution.status).toBe("cancelled");
  });

  test("logs reasons for manual repairs without claiming persisted audit notes", async () => {
    const response = await testApp.post(`/executions?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Repair", wait: true },
    });
    const id = response.body.executionId;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(
      (
        await testApp.post(`/executions/${id}/edit-state?runtimeId=${leftId}`, {
          stepId: "name",
          result: "Fixed",
          reason: "Support repair",
        })
      ).status
    ).toBe(202);
    expect(testApp.logger.info).toHaveBeenCalledWith(
      "Durable dashboard edit-state: Support repair",
      expect.objectContaining({
        data: expect.objectContaining({ executionId: id }),
      })
    );
    expect(
      (
        await testApp.post(`/executions/${id}/force-fail?runtimeId=${leftId}`, {
          reason: "",
        })
      ).status
    ).toBe(400);
    expect(
      (
        await testApp.post(`/executions/${id}/force-fail?runtimeId=${leftId}`, {
          reason: "Stop",
        })
      ).status
    ).toBe(202);
  });
});

test("application without durable resources exposes an empty catalog of runtimes", async () => {
  const app = await fixture(false);
  try {
    expect((await app.get("/runtimes")).body).toEqual({ runtimes: [] });
    expect((await app.get("/executions")).status).toBe(404);
  } finally {
    await close(app.server);
    await app.runtime.dispose();
  }
});

describe("Durable dashboard Runner 6.10 SQLite, versioning, commands, reset, replay and retention", () => {
  async function waitForStatus(
    get: (path: string) => request.Test,
    executionId: string,
    runtimeId: string,
    expected: string[]
  ) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const response = await get(
        `/executions/${executionId}?runtimeId=${runtimeId}`
      );
      if (
        response.status === 200 &&
        expected.includes(response.body.execution.status)
      ) {
        return response.body.execution;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      `Timed out waiting for ${executionId} to reach ${expected.join(", ")}`
    );
  }

  test("supports sqlite backend, multi-version workflows, tracked commands, reset, replay and retention collection", async () => {
    const sqliteDurable = sqliteDurableResource.fork("sqlite-ops");
    const approved = defineEvent({
      id: "approved",
      payloadSchema: z.object({ approved: z.boolean() }),
    });
    const updateAddress = defineTask({
      id: "update-address",
      dependencies: { sqliteDurable },
      inputSchema: z.object({ city: z.string().min(1) }),
      async run(input, { sqliteDurable }) {
        const ctx = sqliteDurable.use();
        await ctx.setState({ city: input.city });
        return { updated: true, city: input.city };
      },
    });
    const undeclaredCommand = defineTask({
      id: "undeclared-command",
      dependencies: { sqliteDurable },
      inputSchema: z.object({}),
      async run() {
        return { ok: true };
      },
    });
    const orderV1 = defineTask({
      id: "order-v1",
      dependencies: { sqliteDurable },
      inputSchema: z.object({
        name: z.string().min(1),
        wait: z.boolean().default(false),
      }),
      tags: [
        durableWorkflowTag.with({
          key: "orders",
          version: 1,
          signals: [approved],
        }),
      ],
      async run(input, { sqliteDurable }) {
        const ctx = sqliteDurable.use();
        await ctx.step("validate", async () => ({ name: input.name, v: 1 }));
        return { version: 1, name: input.name };
      },
    });
    const orderV2 = defineTask({
      id: "order-v2",
      dependencies: { sqliteDurable },
      inputSchema: z.object({
        name: z.string().min(1),
        wait: z.boolean().default(false),
      }),
      tags: [
        durableWorkflowTag.with({
          key: "orders",
          version: 2,
          signals: [approved],
          commands: [updateAddress],
          concurrency: 4,
          retention: {
            onComplete: { afterMs: 86_400_000 },
            receipts: { afterMs: 604_800_000 },
          },
        }),
      ],
      async run(input, { sqliteDurable }) {
        const ctx = sqliteDurable.use();
        await ctx.replaceState({ name: input.name, city: "Bucharest" });
        await ctx.step("validate", async () => ({ name: input.name, v: 2 }));
        if (input.wait) {
          await ctx.waitForSignal(approved, { stepId: "review-approval" });
        }
        const receipt = await ctx.step("settle", async () => ({
          version: 2,
          name: input.name,
        }));
        return receipt;
      },
    });
    const ephemeralFlow = defineTask({
      id: "ephemeral-check",
      dependencies: { sqliteDurable },
      inputSchema: z.object({ checkId: z.string().min(1) }),
      tags: [
        durableWorkflowTag.with({
          key: "ephemeral",
          version: 1,
          retention: {
            onComplete: "delete",
            receipts: { afterMs: 86_400_000 },
          },
        }),
      ],
      async run(input, { sqliteDurable }) {
        return await sqliteDurable.use().step("verify", async () => ({
          checkId: input.checkId,
          ok: true,
        }));
      },
    });

    const runtime = await run(
      defineResource<void>({
        id: "sqliteDashboardTests",
        register: [
          durableSupportResource,
          sqliteDurable.with({
            persist: { filename: ":memory:" },
            audit: { enabled: true },
            timers: { pollIntervalMs: 50 },
            garbageCollection: { enabled: false },
          }),
          approved,
          updateAddress,
          undeclaredCommand,
          orderV1,
          orderV2,
          ephemeralFlow,
        ],
      }),
      { logs: { printThreshold: null } }
    );
    const store = runtime.getResourceValue(resources.store);
    const service = runtime.getResourceValue(sqliteDurable);
    const logger = { info: jest.fn() };
    const app = express();
    app.use(createHttpPasswordGuard("dashboard-test"));
    app.use("/durable/api", createDurableRouter(store, logger));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const client = request(server);
    const auth = `Basic ${Buffer.from("runner:dashboard-test").toString(
      "base64"
    )}`;
    const prefix = "/durable/api";
    const get = (path: string) =>
      client.get(prefix + path).set("Authorization", auth);
    const post = (path: string, body?: Record<string, unknown>) =>
      client
        .post(prefix + path)
        .set("Authorization", auth)
        .send(body);

    try {
      const runtimesRes = await get("/runtimes");
      expect(runtimesRes.status).toBe(200);
      expect(runtimesRes.body.runtimes).toHaveLength(1);
      const rt = runtimesRes.body.runtimes[0];
      expect(rt.backend).toBe("sqlite");
      expect(rt.capabilities).toEqual({
        pause: true,
        resume: true,
        restart: true,
        state: true,
        command: true,
        reset: true,
        replay: true,
      });

      const workflowsRes = await get(`/workflows?runtimeId=${rt.id}`);
      expect(workflowsRes.status).toBe(200);
      const ordersWf = workflowsRes.body.workflows.find(
        (wf: { key: string }) => wf.key === "orders"
      );
      expect(ordersWf.version).toBe(2);
      expect(
        ordersWf.versions.map((v: { version: number | null }) => v.version)
      ).toEqual([2, 1]);
      expect(ordersWf.commands).toHaveLength(1);
      expect(ordersWf.concurrency).toBe("max 4 concurrent");
      expect(ordersWf.retention).toEqual({
        onComplete: { afterMs: 86_400_000 },
        receipts: { afterMs: 604_800_000 },
      });

      // Unknown explicit version returns 404
      expect(
        (
          await post(`/executions?runtimeId=${rt.id}`, {
            workflow: "orders",
            version: 99,
            input: { name: "Ada" },
          })
        ).status
      ).toBe(404);

      // Explicit v1 execution
      const v1Start = await post(`/executions?runtimeId=${rt.id}`, {
        workflow: "orders",
        version: 1,
        input: { name: "Legacy" },
      });
      expect({ status: v1Start.status, body: v1Start.body }).toEqual({
        status: 201,
        body: expect.objectContaining({ executionId: expect.any(String) }),
      });
      const v1Detail = await waitForStatus(
        get,
        v1Start.body.executionId,
        rt.id,
        ["completed"]
      );
      expect(v1Detail.workflowVersion).toBe(1);
      expect(v1Detail.result).toEqual({ version: 1, name: "Legacy" });

      // A one-time start is a timer and cannot be edited as a recurring schedule.
      const onceId = await service.schedule(
        orderV2,
        { name: "One time", wait: false },
        { delay: 600000 }
      );
      expect(
        (await get(`/schedules?runtimeId=${rt.id}`)).body.schedules
      ).toHaveLength(0);
      expect(
        (
          await client
            .patch(`${prefix}/schedules/${onceId}?runtimeId=${rt.id}`)
            .set("Authorization", auth)
            .send({ interval: 500 })
        ).status
      ).toBe(404);

      // Versioned schedule
      await service.schedule(
        orderV2,
        { name: "Scheduled", wait: false },
        { interval: 600000 }
      );
      const schedules = (await get(`/schedules?runtimeId=${rt.id}`)).body
        .schedules;
      expect(schedules[0].workflowVersion).toBe(2);

      // Live v2 execution + tracked commands + reset + replay
      const liveStart = await post(`/executions?runtimeId=${rt.id}`, {
        workflow: "orders",
        input: { name: "Live", wait: true },
      });
      expect(liveStart.status).toBe(201);
      const liveId = liveStart.body.executionId as string;
      await waitUntilWaiting(service, liveId);

      // Undeclared command rejected
      expect(
        (
          await post(`/executions/${liveId}/commands?runtimeId=${rt.id}`, {
            command: undeclaredCommand.id,
            input: {},
          })
        ).status
      ).toBe(400);

      // Declared command executes synchronously and updates state/history
      const commandKey = ordersWf.commands[0].taskKey as string;
      const cmdRes = await post(
        `/executions/${liveId}/commands?runtimeId=${rt.id}`,
        {
          command: commandKey,
          input: { city: "Vienna" },
          idempotencyKey: "cmd-vienna",
        }
      );
      expect(cmdRes.status).toBe(202);
      expect(cmdRes.body).toEqual({
        accepted: true,
        completed: true,
        result: { updated: true, city: "Vienna" },
      });

      const liveDetail = (await get(`/executions/${liveId}?runtimeId=${rt.id}`))
        .body.execution;
      expect(liveDetail.state.state).toEqual({
        name: "Live",
        city: "Vienna",
      });
      expect(
        liveDetail.timeline.some(
          (node: { kind: string; result: unknown }) =>
            node.kind === "command" &&
            (node.result as { city?: string } | null)?.city === "Vienna"
        )
      ).toBe(true);

      // Reset before pausing fails with 409
      expect(
        (
          await post(`/executions/${liveId}/reset?runtimeId=${rt.id}`, {
            beforeStep: "validate",
            reason: "Too early",
          })
        ).status
      ).toBe(409);

      // Pause then enqueue pending command -> returns accepted & pending promptly
      expect(
        (await post(`/executions/${liveId}/pause?runtimeId=${rt.id}`)).status
      ).toBe(202);
      await waitForStatus(get, liveId, rt.id, ["paused"]);

      const pendingCmdRes = await post(
        `/executions/${liveId}/commands?runtimeId=${rt.id}`,
        {
          command: commandKey,
          input: { city: "Prague" },
        }
      );
      expect(pendingCmdRes.status).toBe(202);
      expect(pendingCmdRes.body).toMatchObject({
        accepted: true,
        completed: false,
        pending: true,
      });

      // Completed v2 run for clean checkpoint branch + replay export
      const completedStart = await post(`/executions?runtimeId=${rt.id}`, {
        workflow: "orders",
        input: { name: "ResetSource", wait: false },
      });
      const completedId = completedStart.body.executionId as string;
      await waitForStatus(get, completedId, rt.id, ["completed"]);

      const replayRes = await get(
        `/executions/${completedId}/replay?runtimeId=${rt.id}`
      );
      expect(replayRes.status).toBe(200);
      expect(replayRes.body.fixture.execution.id).toBe(completedId);
      expect(replayRes.body.fixture.history.length).toBeGreaterThan(0);

      const branchRes = await post(
        `/executions/${completedId}/reset?runtimeId=${rt.id}`,
        {
          beforeStep: "settle",
          reason: "Re-run settle",
        }
      );
      expect(branchRes.status).toBe(202);
      const branchId = branchRes.body.executionId as string;
      const branchDetail = await waitForStatus(get, branchId, rt.id, [
        "completed",
      ]);
      expect(branchDetail.resetFromExecutionId).toBe(completedId);
      expect(branchDetail.resetBeforeStep).toBe("settle");
      expect(branchDetail.resetReason).toBe("Re-run settle");
      expect(logger.info).toHaveBeenCalledWith(
        "Durable dashboard reset before 'settle': Re-run settle",
        expect.objectContaining({
          data: expect.objectContaining({
            executionId: completedId,
            branchExecutionId: branchId,
            beforeStep: "settle",
          }),
        })
      );

      // History collection retention check
      const ephemStart = await post(`/executions?runtimeId=${rt.id}`, {
        workflow: "ephemeral",
        input: { checkId: "CHK-1" },
      });
      const ephemId = ephemStart.body.executionId as string;
      await waitForStatus(get, ephemId, rt.id, ["completed"]);
      await service
        .getStore()
        .collectCompletedHistory?.(new Date(Date.now() + 60_000), 20);

      const collectedDetail = (
        await get(`/executions/${ephemId}?runtimeId=${rt.id}`)
      ).body.execution;
      expect(collectedDetail.historyCollectedAt).toBeTruthy();
      expect(collectedDetail.result).toEqual({ checkId: "CHK-1", ok: true });
      expect(
        (await post(`/executions/${ephemId}/restart?runtimeId=${rt.id}`)).status
      ).toBe(409);
      expect(
        (
          await post(`/executions/${ephemId}/reset?runtimeId=${rt.id}`, {
            beforeStep: "verify",
            reason: "Cannot reset collected",
          })
        ).status
      ).toBe(409);
      expect(
        (await get(`/executions/${ephemId}/replay?runtimeId=${rt.id}`)).status
      ).toBe(409);
      const blockedRestart = await post(
        `/executions/${ephemId}/restart?runtimeId=${rt.id}`,
        { input: { checkId: "CHK-2" } }
      );
      expect(blockedRestart.status).toBe(409);
      const freshRun = await post(`/executions?runtimeId=${rt.id}`, {
        workflow: "ephemeral",
        input: { checkId: "CHK-2" },
      });
      expect(freshRun.status).toBe(201);
      expect(freshRun.body.executionId).toBeTruthy();

      // Persisted schedule referencing an unregistered version rejects input updates (404)
      const missingVersionScheduleId = "legacy-v99-schedule";
      const now = new Date();
      await service.getStore().createSchedule({
        id: missingVersionScheduleId,
        workflowKey: "orders",
        workflowVersion: 99,
        type: "interval",
        pattern: "60000",
        input: { name: "Old", wait: false },
        status: "active",
        nextRun: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now,
      });
      const patchMissingVersion = await client
        .patch(
          `${prefix}/schedules/${missingVersionScheduleId}?runtimeId=${rt.id}`
        )
        .set("Authorization", auth)
        .send({ input: { name: "StillInvalidForV99", wait: false } });
      expect(patchMissingVersion.status).toBe(404);

      // Continuation chains longer than 25 links resolve tip status dynamically
      for (let hop = 0; hop <= 30; hop += 1) {
        const isLast = hop === 30;
        await service.getStore().saveExecution({
          id: `cont-chain-${hop}`,
          workflowKey: "orders",
          workflowVersion: 2,
          input: { name: `Hop-${hop}`, wait: false },
          status: isLast
            ? ExecutionStatus.Completed
            : ExecutionStatus.ContinuedAsNew,
          attempt: 1,
          maxAttempts: 1,
          createdAt: now,
          updatedAt: now,
          ...(isLast
            ? { completedAt: now }
            : { continuedAsExecutionId: `cont-chain-${hop + 1}` }),
        });
      }
      const chainRootDetail = await get(
        `/executions/cont-chain-0?runtimeId=${rt.id}`
      );
      expect(chainRootDetail.status).toBe(200);
      expect(chainRootDetail.body.execution.continuedChainTipStatus).toBe(
        "completed"
      );
    } finally {
      await close(server);
      await runtime.dispose();
    }
  });
});

async function waitUntilWaiting(
  service: {
    operator: {
      getExecutionDetail: (id: string) => Promise<{
        execution: { current?: { kind?: string } } | null;
      }>;
    };
    getStore: () => { hasExecutionLease?: (id: string) => Promise<boolean> };
  },
  executionId: string
) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const detail = await service.operator.getExecutionDetail(executionId);
    const leased = await service.getStore().hasExecutionLease?.(executionId);
    if (detail.execution?.current?.kind === "waitForSignal" && !leased) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${executionId} to park at signal.`);
}
