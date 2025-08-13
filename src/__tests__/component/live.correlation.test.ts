import { resource, run, task, globals } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { schema } from "../../schema";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/dev.telemetry.resource";
import { graphql } from "graphql";

describe("Live correlation and chain tracking", () => {
  test("correlationId propagates across nested tasks and runs expose parent/root", async () => {
    let ctx: any;

    const inner = task({
      id: "probe.chain.inner",
      dependencies: { emitLog: globals.events.log },
      async run(_i, { emitLog }) {
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "chain-inner",
        });
      },
    });

    const outer = task({
      id: "probe.chain.outer",
      dependencies: { inner, emitLog: globals.events.log },
      async run(_i, { inner, emitLog }) {
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "chain-outer",
        });
        await inner();
      },
    });

    const root = task({
      id: "probe.chain.root",
      on: globals.events.afterInit,
      listenerOrder: 1,
      dependencies: { outer, emitLog: globals.events.log },
      async run(_e, { outer, emitLog }) {
        await emitLog({
          timestamp: new Date(),
          level: "info",
          message: "chain-root",
        });
        await outer();
      },
    });

    const probe = resource({
      id: "probe.chain",
      register: [inner, outer, root],
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });

    const app = createDummyApp([live, introspector, telemetry, probe]);
    await run(app);

    // Discover correlationId from runs
    const runs = ctx.live.getRuns(0);
    const rootRun = runs.find((r: any) => r.nodeId === "probe.chain.root");
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
    expect(runsById["probe.chain.root"].parentId ?? null).toBeNull();
    expect(runsById["probe.chain.root"].rootId).toBe("probe.chain.root");
    expect(runsById["probe.chain.root"].correlationId).toBe(corr);

    expect(runsById["probe.chain.outer"].parentId).toBe("probe.chain.root");
    expect(runsById["probe.chain.outer"].rootId).toBe("probe.chain.root");
    expect(runsById["probe.chain.outer"].correlationId).toBe(corr);

    expect(runsById["probe.chain.inner"].parentId).toBe("probe.chain.outer");
    expect(runsById["probe.chain.inner"].rootId).toBe("probe.chain.root");
    expect(runsById["probe.chain.inner"].correlationId).toBe(corr);

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
