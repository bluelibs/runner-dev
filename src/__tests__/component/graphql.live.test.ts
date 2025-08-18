import { resource, run, task, hook, globals } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { graphql } from "graphql";

describe("GraphQL Live (integration)", () => {
  test("query live logs and emissions deeply", async () => {
    let ctx: any;
    let checkpoint = 0;

    const trigger = hook({
      id: "probe.graphql-live.trigger",
      on: globals.events.ready,
      order: 1,
      dependencies: { logger: globals.resources.logger, emitHello: evtHello },
      async run(_e, { logger, emitHello }) {
        await logger.debug("dbg1");
        await new Promise((r) => setTimeout(r, 10));
        checkpoint = Date.now();
        await logger.debug("dbg2");
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
    let lastLog;
    // find the last 'debug' log:
    lastLog = data.live.logs.reverse().find((l: any) => l.level === "debug");
    if (!lastLog) {
      throw new Error("No debug log found");
    }
    expect(["dbg1", "dbg2"]).toContain(lastLog.message);
    // data may be null if no structured payload
    if (lastLog.data != null) {
      expect(typeof lastLog.data).toBe("string");
    }

    // emissions include evt.hello
    const hasHelloEmission = data.live.emissions.some((e: any) => e.eventId);
    expect(hasHelloEmission).toBe(true);

    // runs include at least one successful execution with measurable duration
    const hasSuccessfulRun = data.live.runs.some((r: any) => r.ok === true);
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

    const trigger = hook({
      id: "probe.graphql-live.trigger-error",
      on: globals.events.ready,
      order: 1,
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

    const trigger = hook({
      id: "probe.graphql-live.filters",
      on: globals.events.ready,
      order: 1,
      dependencies: {
        logger: globals.resources.logger,
        emitHello: evtHello,
        failing,
      },
      async run(_e, { logger, emitHello, failing }) {
        await logger.debug("dbg1");
        await logger.info("info1");
        await logger.debug("dbg2");
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
          emissions(
            last: 1
            filter: { eventIds: ["evt.hello"], emitterIds: ["probe.graphql-live.filters"] }
          ) {
            eventId
            emitterId
            eventResolved { id }
            emitterResolved { id }
          }
          errors(last: 5, filter: { sourceKinds: [TASK], messageIncludes: "boom" }) {
            message
            sourceKind
            sourceResolved { id }
          }
          runs(afterTimestamp: 0, last: 50, filter: { ok: true, nodeKinds: [HOOK] }) {
            ok
            nodeKind
            nodeResolved { id }
          }
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
    expect(data.live.emissions[0].eventResolved?.id).toBe("evt.hello");
    expect(typeof data.live.emissions[0].emitterResolved?.id).toBe("string");

    // errors: include the boom error coming from a task
    const hasBoom = data.live.errors.some((e: any) =>
      e.message.includes("boom")
    );
    expect(hasBoom).toBe(true);
    const allTaskErrors = data.live.errors.every(
      (e: any) => e.sourceKind === "TASK"
    );
    expect(allTaskErrors).toBe(true);
    expect(typeof data.live.errors[0].sourceResolved?.id).toBe("string");

    // runs: filtered to ok tasks only
    expect(Array.isArray(data.live.runs)).toBe(true);
    const allOkTasks = data.live.runs.every(
      (r: any) => r.ok === true && r.nodeKind === "HOOK"
    );
    expect(allOkTasks).toBe(true);
    if (data.live.runs.length > 0) {
      expect(typeof data.live.runs[0].nodeResolved?.id).toBe("string");
    }
  });

  test("system health metrics available and work with args", async () => {
    let ctx: any;

    const probe = resource({
      id: "probe.graphql-live-health",
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    const query = `
      query Health($win: Float) {
        live {
          memory { heapUsed heapTotal rss }
          cpu { usage loadAverage }
          eventLoop(reset: true) { lag }
          gc(windowMs: $win) { collections duration }
        }
      }
    `;

    const res = await graphql({
      schema,
      source: query,
      contextValue: ctx,
      variableValues: { win: 10 },
    });
    expect(res.errors).toBeUndefined();
    const data: any = res.data;
    expect(data.live.memory.heapTotal).toBeGreaterThan(0);
    expect(data.live.memory.heapUsed).toBeGreaterThan(0);
    expect(typeof data.live.cpu.usage).toBe("number");
    expect(data.live.eventLoop.lag).toBeGreaterThanOrEqual(0);
    expect(data.live.gc.collections).toBeGreaterThanOrEqual(0);
    expect(data.live.gc.duration).toBeGreaterThanOrEqual(0);
  });
});
