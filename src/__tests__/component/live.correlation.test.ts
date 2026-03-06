import {
  defineResource,
  run,
  defineTask,
  resources,
  events,
  defineHook,
} from "@bluelibs/runner";
import { createDummyApp, dummyAppIds } from "../dummy/dummyApp";
import { schema } from "../../schema";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { graphql } from "graphql";

describe("Live correlation and chain tracking", () => {
  test("correlationId propagates across nested tasks and runs expose parent/root", async () => {
    let ctx: any;
    const probeResourceId = dummyAppIds.resource("probe-chain");
    const innerTaskId = `${probeResourceId}.tasks.probe-chain-inner`;
    const outerTaskId = `${probeResourceId}.tasks.probe-chain-outer`;
    const rootHookId = `${probeResourceId}.hooks.probe-chain-root-hook`;

    const inner = defineTask({
      id: "probe-chain-inner",
      dependencies: { logger: resources.logger },
      async run(_i, { logger }) {
        await logger.info("chain-inner");
      },
    });

    const outer = defineTask({
      id: "probe-chain-outer",
      dependencies: { inner, logger: resources.logger },
      async run(_i, { inner, logger }) {
        await logger.info("chain-outer");
        await inner();
      },
    });

    const rootHook = defineHook({
      id: "probe-chain-root-hook",
      on: events.ready,
      order: 1,
      dependencies: { outer, logger: resources.logger },
      async run(_e, { outer, logger }) {
        await logger.info("chain-root");
        // how to properly do correlation id with hooks?
        await outer();
      },
    });

    const probe = defineResource({
      id: "probe-chain",
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
    const rootRun = runs.find((r: any) => r.nodeId === rootHookId);
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
    expect(runsById[rootHookId].parentId).toBe(events.ready.id);
    expect(runsById[rootHookId].rootId).toBe(events.ready.id);
    expect(runsById[rootHookId].correlationId).toBe(corr);

    expect(runsById[outerTaskId].parentId).toBe(events.ready.id);
    expect(runsById[outerTaskId].rootId).toBe(events.ready.id);
    expect(runsById[outerTaskId].correlationId).toBe(corr);

    expect(runsById[innerTaskId].parentId).toBe(outerTaskId);
    expect(runsById[innerTaskId].rootId).toBe(events.ready.id);
    expect(runsById[innerTaskId].correlationId).toBe(corr);

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
