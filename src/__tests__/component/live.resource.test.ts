import { resource, run, task, hook, globals } from "@bluelibs/runner";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";

describe("live resource (integration)", () => {
  test("records logs and emissions via tasks", async () => {
    let checkpoint = 0;

    const trigger = hook({
      id: "probe.live.trigger",
      on: globals.events.ready,
      order: 1,
      dependencies: { emitHello: evtHello, logger: globals.resources.logger },
      async run(_e, { emitHello, logger }) {
        await logger.info("hello-1");
        await emitHello({ name: "world" });
        await new Promise((r) => setTimeout(r, 10));
        checkpoint = Date.now();
        await logger.info("hello-2");
        await new Promise((r) => setTimeout(r, 5));
        await emitHello({ name: "world" });
      },
    });

    const reader = hook({
      id: "probe.live.reader",
      on: evtHello,
      order: 999,
      dependencies: { live },
      async run(_e, { live }) {
        return {
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
    const { getResourceValue } = await run(app);
    const containerLive = await getResourceValue(live);
    const snapshot = {
      logs: containerLive.getLogs(),
      emissions: containerLive.getEmissions(),
      logsAfter: containerLive.getLogs(checkpoint),
      emissionsAfter: containerLive.getEmissions(checkpoint),
    };

    expect(snapshot.logs?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot.logs.some((l: any) => l.message === "hello-1")).toBe(true);

    expect(snapshot.emissions.length).toBeGreaterThan(0);
    expect(snapshot.emissions[0]).toHaveProperty("timestampMs");

    // After timestamp filters
    expect(
      snapshot.emissionsAfter.every((l: any) => l.eventId === "evt.hello")
    ).toBe(true);
    expect(snapshot.emissionsAfter.length).toBeGreaterThan(0);
  });
});
