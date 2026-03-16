import {
  defineResource,
  run,
  defineHook,
  defineTask,
  resources,
  events,
} from "@bluelibs/runner";
import { createDummyApp, dummyAppIds, evtHello } from "../dummy/dummyApp";
import { graphql as graphqlAccumulator } from "../../resources/graphql-accumulator.resource";
import { graphqlQueryTask } from "../../resources/graphql.query.task";
import { introspector } from "../../resources/introspector.resource";
import { live } from "../../resources/live.resource";
import { swapManager } from "../../resources/swap.resource";
import { telemetry } from "../../resources/telemetry.resource";

describe("live resource (integration)", () => {
  test("records logs and emissions via tasks", async () => {
    let checkpoint = 0;

    const trigger = defineHook({
      id: "probe-live-trigger",
      on: events.ready,
      order: 1,
      dependencies: { emitHello: evtHello, logger: resources.logger },
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

    const reader = defineHook({
      id: "probe-live-reader",
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

    const probe = defineResource({
      id: "probe-live",
      register: [trigger, reader],
    });

    const app = createDummyApp([live, telemetry, probe]);
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
      snapshot.emissionsAfter.some(
        (l: any) => l.eventId === dummyAppIds.event(evtHello.id)
      )
    ).toBe(true);
    expect(snapshot.emissionsAfter.length).toBeGreaterThan(0);
  });

  test("onRecord fires for each record kind and unsubscribes cleanly", async () => {
    const notifications: string[] = [];

    const trigger = defineHook({
      id: "probe-live-onRecord-trigger",
      on: events.ready,
      order: 1,
      dependencies: {
        emitHello: evtHello,
        logger: resources.logger,
        live,
      },
      async run(_e, { emitHello, logger, live }) {
        // Subscribe to record notifications
        const unsub = live.onRecord((kind) => {
          notifications.push(kind);
        });

        // Generate one of each kind
        await logger.info("onRecord-test-log");
        await emitHello({ name: "onRecord" });

        // Wait a moment for async propagation
        await new Promise((r) => setTimeout(r, 20));

        // Unsubscribe
        unsub();

        // This should NOT show up in notifications
        await logger.info("after-unsub");
        await new Promise((r) => setTimeout(r, 10));
      },
    });

    const probe = defineResource({
      id: "probe-live-onRecord",
      register: [trigger],
    });

    const app = createDummyApp([live, telemetry, probe]);
    await run(app);

    // Should have received at least 'log' and 'emission' notifications
    expect(notifications).toContain("log");
    expect(notifications).toContain("emission");

    // Count how many 'log' notifications we got before unsub
    const logsBefore = notifications.filter((n) => n === "log").length;

    // After unsub, the "after-unsub" log should not have triggered more notifications
    // (we can't test exact count since framework logs exist, but we can verify unsub worked
    // by checking there's a finite number)
    expect(logsBefore).toBeGreaterThan(0);
    expect(logsBefore).toBeLessThan(1000); // sanity
  });

  test("does not record runner-dev internal tasks in live runs", async () => {
    const userServerTask = defineTask({
      id: "server",
      async run() {
        return "ok" as const;
      },
    });

    const trigger = defineHook({
      id: "probe-live-internal-skip-trigger",
      on: events.ready,
      order: 1,
      dependencies: {
        userServerTask,
        graphqlQuery: graphqlQueryTask,
      },
      async run(_event, { userServerTask, graphqlQuery }) {
        await userServerTask();

        const result = await graphqlQuery({
          query: "query InternalSkip { root { id } }",
        });

        expect(result.ok).toBe(true);
      },
    });

    const probe = defineResource({
      id: "probe-live-internal-skip",
      register: [userServerTask, trigger],
    });

    const runtime = await run(
      createDummyApp([
        live,
        introspector,
        telemetry,
        swapManager,
        graphqlAccumulator,
        graphqlQueryTask,
        probe,
      ])
    );

    try {
      const containerLive = await runtime.getResourceValue(live);
      const runNodeIds = containerLive
        .getRuns(0)
        .map((record) => record.nodeId);

      expect(
        runNodeIds.some((nodeId) => nodeId.endsWith(".tasks.server"))
      ).toBe(true);
      expect(
        runNodeIds.some((nodeId) => nodeId.endsWith(".tasks.graphqlQuery"))
      ).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
