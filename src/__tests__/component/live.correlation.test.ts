import { resource, run, task, globals, hook } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { schema } from "../../schema";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { graphql } from "graphql";

describe("Live correlation and chain tracking", () => {
  test("correlationId propagates across nested tasks and runs expose parent/root", async () => {
    let ctx: any;

    const inner = task({
      id: "probe.chain.inner",
      dependencies: { logger: globals.resources.logger },
      async run(_i, { logger }) {
        await logger.info("chain-inner");
      },
    });

    const outer = task({
      id: "probe.chain.outer",
      dependencies: { inner, logger: globals.resources.logger },
      async run(_i, { inner, logger }) {
        await logger.info("chain-outer");
        await inner();
      },
    });

    const rootHook = hook({
      id: "probe.chain.root.hook",
      on: globals.events.ready,
      order: 1,
      dependencies: { outer, logger: globals.resources.logger },
      async run(_e, { outer, logger }) {
        await logger.info("chain-root");
        // how to properly do correlation id with hooks?
        await outer();
      },
    });

    const probe = resource({
      id: "probe.chain",
      register: [inner, outer, rootHook],
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    // Discover correlationId from runs
    const runs = ctx.live.getRuns(0);
    const rootRun = runs.find((r: any) => r.nodeId === rootHook.id);
    expect(rootRun?.correlationId).toBeTruthy();
    const corr = rootRun!.correlationId;

    // Query GraphQL for runs and logs with correlation id
    const query = `
      query Check($ts: Float) {
        live {
          runs(afterTimestamp: $ts) {
            nodeId
            parentId
            rootId
            correlationId
          }
          logs(last: 50, filter: { correlationIds: ["${corr}"] }) {
            message
            correlationId
          }
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

    // Validate runs parent/root relationships and correlation
    const runsById: Record<string, any> = Object.fromEntries(
      data.live.runs.map((r: any) => [r.nodeId, r])
    );
    expect(runsById[rootHook.id].parentId).toBe("globals.events.ready");
    expect(runsById[rootHook.id].rootId).toBe(globals.events.ready.id);
    expect(runsById[rootHook.id].correlationId).toBe(corr);

    expect(runsById[outer.id].parentId).toBe(globals.events.ready.id);
    expect(runsById[outer.id].rootId).toBe(globals.events.ready.id);
    expect(runsById[outer.id].correlationId).toBe(corr);

    expect(runsById[inner.id].parentId).toBe(outer.id);
    expect(runsById[inner.id].rootId).toBe(globals.events.ready.id);
    expect(runsById[inner.id].correlationId).toBe(corr);

    // Validate logs filtering by correlation id and log correlation ids
    const messages = data.live.logs.map((l: any) => l.message);
    expect(messages).toEqual(
      expect.arrayContaining(["chain-root", "chain-outer", "chain-inner"])
    );
    const allMatchCorr = data.live.logs.every(
      (l: any) => l.correlationId === corr
    );
    expect(allMatchCorr).toBe(true);
  });
});
