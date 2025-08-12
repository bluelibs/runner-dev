import { resource, run, task, globals } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, evtHello } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";

describe("GraphQL Live (integration)", () => {
  test("query live logs and emissions deeply", async () => {
    let ctx: any;

    const trigger = task({
      id: "probe.graphql-live.trigger",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { emitLog: globals.events.log, emitHello: evtHello },
      async run(_e, { emitLog, emitHello }) {
        await emitLog({
          timestamp: new Date(),
          level: "debug",
          message: "dbg message",
          data: { x: 42 },
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
    expect(lastLog.message).toBe("dbg message");
    // payload stringified
    expect(lastLog.data).toContain("x");

    // emissions include evt.hello
    const hasHelloEmission = data.live.emissions.some((e: any) => e.eventId);
    expect(hasHelloEmission).toBe(true);
  });
});
