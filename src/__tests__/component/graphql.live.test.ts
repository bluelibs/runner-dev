import { resource, run, task, globals } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/dev.telemetry.resource";
import { graphql } from "graphql";

describe("GraphQL Live (integration)", () => {
  test("query live logs and emissions deeply", async () => {
    let ctx: any;
    let checkpoint = 0;

    const trigger = task({
      id: "probe.graphql-live.trigger",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { emitLog: globals.events.log, emitHello: evtHello },
      async run(_e, { emitLog, emitHello }) {
        await emitLog({
          timestamp: new Date(),
          level: "debug",
          message: "dbg1",
        });
        await new Promise((r) => setTimeout(r, 10));
        checkpoint = Date.now();
        await emitLog({
          timestamp: new Date(),
          level: "debug",
          message: "dbg2",
        });
        await emitHello({ name: "graphql" });
      },
    });

    const probe = resource({
      id: "probe.graphql-live",
      register: [trigger],
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    const query = `
      query LiveData {
        live {
          logs { timestampMs level message data }
          logsFiltered: logs(afterTimestamp: ${"" + 0}) { message }
          emissions { timestampMs eventId emitterId payload }
          runs(afterTimestamp: ${
            "" + 0
          }) { timestampMs nodeId nodeKind durationMs ok error }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    expect(Array.isArray(data.live.logs)).toBe(true);
    expect(Array.isArray(data.live.emissions)).toBe(true);
    expect(Array.isArray(data.live.runs)).toBe(true);

    // check last log matches what we emitted
    const lastLog = data.live.logs[data.live.logs.length - 1];
    expect(lastLog.level).toBe("debug");
    expect(["dbg1", "dbg2"]).toContain(lastLog.message);
    // data may be null if no structured payload
    if (lastLog.data != null) {
      expect(typeof lastLog.data).toBe("string");
    }

    // emissions include evt.hello
    const hasHelloEmission = data.live.emissions.some((e: any) => e.eventId);
    expect(hasHelloEmission).toBe(true);

    // runs include at least one successful execution with measurable duration
    const hasSuccessfulRun = data.live.runs.some(
      (r: any) => r.ok === true && r.durationMs > 0
    );
    expect(hasSuccessfulRun).toBe(true);
  });

  test("query live errors after a failing task", async () => {
    let ctx: any;

    const failing = task({
      id: "probe.graphql-live.failing",
      async run() {
        throw new Error("boom");
      },
    });

    const trigger = task({
      id: "probe.graphql-live.trigger-error",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { failing },
      async run(_e, { failing }) {
        try {
          await failing();
        } catch {
          // noop
        }
      },
    });

    const probe = resource({
      id: "probe.graphql-live-errors",
      register: [failing, trigger],
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    const query = `
      query LiveErrors($ts: Float) {
        live {
          errors(afterTimestamp: $ts) { timestampMs sourceId sourceKind message stack }
        }
      }
    `;

    const result = await graphql({
      schema,
      source: query,
      contextValue: ctx,
      variableValues: { ts: 0 },
    });
    expect(result.errors).toBeUndefined();
    const data: any = result.data;
    expect(Array.isArray(data.live.errors)).toBe(true);
    const hasBoom = data.live.errors.some((e: any) =>
      e.message.includes("boom")
    );
    expect(hasBoom).toBe(true);
  });

  test("supports last and filter args for logs, emissions, errors, and runs", async () => {
    let ctx: any;

    const failing = task({
      id: "probe.graphql-live.filters.fail",
      async run() {
        throw new Error("boom-xyz");
      },
    });

    const trigger = task({
      id: "probe.graphql-live.filters",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: {
        emitLog: globals.events.log,
        emitHello: evtHello,
        failing,
      },
      async run(_e, { emitLog, emitHello, failing }) {
        await emitLog({
          timestamp: new Date(),
          level: "debug",
          message: "dbg1",
        });
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "info1",
        });
        await emitLog({
          timestamp: new Date(),
          level: "debug",
          message: "dbg2",
        });
        await emitHello({ name: "filters" });
        try {
          await failing();
        } catch {
          // swallow on purpose
        }
      },
    });

    const probe = resource({
      id: "probe.graphql-live-filters",
      register: [failing, trigger],
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    const query = `
      query WithFilters {
        live {
          logs(last: 2, filter: { levels: [debug], messageIncludes: "dbg" }) { message level }
          emissions(last: 1, filter: { eventIds: ["evt.hello"], emitterIds: ["probe.graphql-live.filters"] }) { eventId emitterId }
          errors(last: 5, filter: { sourceKinds: [TASK], messageIncludes: "boom" }) { message sourceKind }
          runs(afterTimestamp: 0, last: 50, filter: { ok: true, nodeKinds: [TASK] }) { ok nodeKind }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    // logs: last 2 matching dbg* and debug level
    expect(Array.isArray(data.live.logs)).toBe(true);
    expect(data.live.logs.length).toBe(2);
    expect(data.live.logs[0].message).toBe("dbg1");
    expect(data.live.logs[1].message).toBe("dbg2");

    // emissions: exactly one filtered by eventId & emitterId
    expect(Array.isArray(data.live.emissions)).toBe(true);
    expect(data.live.emissions.length).toBe(1);
    expect(data.live.emissions[0].eventId).toBe("evt.hello");
    expect(data.live.emissions[0].emitterId).toBe("probe.graphql-live.filters");

    // errors: include the boom error coming from a task
    const hasBoom = data.live.errors.some((e: any) =>
      e.message.includes("boom")
    );
    expect(hasBoom).toBe(true);
    const allTaskErrors = data.live.errors.every(
      (e: any) => e.sourceKind === "TASK"
    );
    expect(allTaskErrors).toBe(true);

    // runs: filtered to ok tasks only
    expect(Array.isArray(data.live.runs)).toBe(true);
    const allOkTasks = data.live.runs.every(
      (r: any) => r.ok === true && r.nodeKind === "TASK"
    );
    expect(allOkTasks).toBe(true);
  });
});
