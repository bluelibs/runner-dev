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
    expect(runtimes[0].capabilities).toEqual({
      pause: false,
      resume: false,
      restart: false,
      state: false,
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

  test("creates, validates and operates real runtime-scoped schedules", async () => {
    const response = await testApp.post(`/schedules?runtimeId=${leftId}`, {
      workflow: "leftFlow",
      input: { name: "Schedule", wait: false },
      interval: 600000,
    });
    expect(response.status).toBe(201);
    const id = response.body.scheduleId;
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
        await testApp.post(`/schedules?runtimeId=${leftId}`, {
          workflow: "leftFlow",
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
