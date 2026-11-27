import { setTimeout as delay } from "node:timers/promises";
import { close, fixture } from "./durable.dashboard.fixtures";

test("drills into actual ticks and excludes manual starts and similarly named schedules for the same workflow", async () => {
  const app = await fixture();
  try {
    const runtimes = (await app.get("/runtimes")).body.runtimes;
    const left: string = runtimes.find((r: { id: string }) =>
      r.id.endsWith(".left")
    ).id;
    const right: string = runtimes.find((r: { id: string }) =>
      r.id.endsWith(".right")
    ).id;
    const config = { workflow: "leftFlow", input: { name: "billing" } };
    const manual = await app.post("/executions?runtimeId=" + left, config);
    expect(manual.status).toBe(201);
    for (const id of ["billing", "billing:eu"]) {
      expect(
        (
          await app.post("/schedules?runtimeId=" + left, {
            ...config,
            id,
            interval: 120,
          })
        ).status
      ).toBe(201);
    }
    async function read(id: string) {
      const res = await app.get(
        `/schedules/${encodeURIComponent(id)}/runs?runtimeId=${left}`
      );
      expect(res.status).toBe(200);
      return res.body.executions as { id: string }[];
    }
    const deadline = Date.now() + 8000;
    for (const id of ["billing", "billing:eu"]) {
      let runs = await read(id);
      while (!runs.length && Date.now() < deadline) {
        await delay(100);
        runs = await read(id);
      }
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) {
        expect(run.id).toMatch(new RegExp("^timer:sched:" + id + ":\\d+$"));
        expect(run.id).not.toBe(manual.body.executionId);
      }
      expect(
        (
          await app.get(
            `/executions/${encodeURIComponent(runs[0].id)}?runtimeId=${left}`
          )
        ).status
      ).toBe(200);
    }
    expect(
      (await app.get("/schedules/billing/runs?runtimeId=" + right)).status
    ).toBe(404);
  } finally {
    await close(app.server);
    await app.runtime.dispose();
  }
}, 15000);
