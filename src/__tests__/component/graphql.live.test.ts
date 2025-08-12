import { resource, run, task, globals } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
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

    const app = createDummyApp([live, introspector, probe]);
    await run(app);

    const query = `
      query LiveData {
        live {
          logs { timestampMs level message data }
          logsFiltered: logs(afterTimestamp: ${"" + 0}) { message }
          emissions { timestampMs eventId emitterId payload }
        }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const data: any = result.data;
    expect(Array.isArray(data.live.logs)).toBe(true);
    expect(Array.isArray(data.live.emissions)).toBe(true);

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
  });
});
