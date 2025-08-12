import { resource, run, task, globals } from "@bluelibs/runner";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";

describe("live resource (integration)", () => {
  test("records logs and emissions via tasks", async () => {
    let snapshot: any = {};
    let checkpoint = 0;

    const trigger = task({
      id: "probe.live.trigger",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { emitLog: globals.events.log, emitHello: evtHello },
      async run(_e, { emitLog, emitHello }) {
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "hello-1",
          data: { a: 1 },
        });
        await new Promise((r) => setTimeout(r, 10));
        checkpoint = Date.now();
        await new Promise((r) => setTimeout(r, 5));
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "hello-2",
          data: { a: 2 },
        });
        await emitHello({ name: "world" });
      },
    });

    const reader = task({
      id: "probe.live.reader",
      on: evtHello,
      listenerOrder: 999,
      dependencies: { live },
      async run(_e, { live }) {
        snapshot = {
          logs: live.getLogs(),
          emissions: live.getEmissions(),
          logsAfter: live.getLogs(checkpoint),
          emissionsAfter: live.getEmissions(checkpoint),
        };
      },
    });

    const probe = resource({
      id: "probe.live",
      register: [trigger, reader],
    });

    const app = createDummyApp([live, probe]);
    await run(app);

    expect(snapshot.logs?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot.logs.some((l: any) => l.message === "hello-1")).toBe(true);

    expect(snapshot.emissions.length).toBeGreaterThan(0);
    expect(snapshot.emissions[0]).toHaveProperty("timestampMs");

    // After timestamp filters
    expect(snapshot.logsAfter.every((l: any) => l.message === "hello-2")).toBe(
      true
    );
    expect(snapshot.emissionsAfter.length).toBeGreaterThan(0);
  });
});
