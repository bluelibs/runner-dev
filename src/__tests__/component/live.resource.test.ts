import { resource, run, task, globals } from "@bluelibs/runner";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";

describe("live resource (integration)", () => {
  test("records logs and emissions via tasks", async () => {
    let snapshot: any = {};

    const trigger = task({
      id: "probe.live.trigger",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { emitLog: globals.events.log, emitHello: evtHello },
      async run(_e, { emitLog, emitHello }) {
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "hello",
          data: { a: 1 },
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
        snapshot = { logs: live.getLogs(), emissions: live.getEmissions() };
      },
    });

    const probe = resource({
      id: "probe.live",
      register: [trigger, reader],
    });

    const app = createDummyApp([live, probe]);
    await run(app);

    expect(snapshot.logs?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot.logs[0]).toMatchObject({
      level: "info",
      message: "hello",
    });

    expect(snapshot.emissions.length).toBeGreaterThan(0);
    expect(snapshot.emissions[0]).toHaveProperty("timestampMs");
  });
});
