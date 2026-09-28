import { defineResource, run } from "@bluelibs/runner";
import { graphql, GraphQLObjectType } from "graphql";
import { schema } from "../../schema";
import { createDummyApp } from "../dummy/dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";

describe("GraphQL live sequence cursors", () => {
  test("every live list exposes sequence and pages forward with afterSequence", async () => {
    let ctx: any;
    const probe = defineResource({
      id: "probe-graphql-live-sequence",
      dependencies: { live, introspector },
      async init(_config, { live, introspector }) {
        ctx = { store: undefined, logger: console, introspector, live };
      },
    });
    const runtime = await run(createDummyApp([live, introspector, probe]));
    const liveStore = await runtime.getResourceValue(live);

    // Three entries per category, all within one millisecond.
    const clock = jest.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
    for (const label of ["a", "b", "c"]) {
      liveStore.recordLog("info", `gql-seq-${label}`);
      liveStore.recordEmission(`gql-seq-event`, label);
      liveStore.recordError("gql-seq-source", "INTERNAL", `gql-seq-${label}`);
      liveStore.recordRun(`gql-seq-node-${label}`, "TASK", 1, true);
    }
    clock.mockRestore();

    const cursors = {
      log: liveStore.getLogs({ messageIncludes: "gql-seq-a" })[0].sequence,
      emission: liveStore.getEmissions({ eventIds: ["gql-seq-event"] })[0]
        .sequence,
      error: liveStore.getErrors({ messageIncludes: "gql-seq-a" })[0].sequence,
      run: liveStore.getRuns({ nodeIds: ["gql-seq-node-a"] })[0].sequence,
    };

    try {
      const result = await graphql({
        schema,
        source: `query Paged($log: Float, $emission: Float, $error: Float, $run: Float) {
          live {
            logs(afterSequence: $log, last: 1, filter: { messageIncludes: "gql-seq" }) { message sequence }
            emissions(afterSequence: $emission, last: 1, filter: { eventIds: ["gql-seq-event"] }) { payload sequence }
            errors(afterSequence: $error, last: 1, filter: { messageIncludes: "gql-seq" }) { message sequence }
            runs(afterSequence: $run, last: 1) { nodeId sequence }
          }
        }`,
        contextValue: ctx,
        variableValues: cursors,
      });

      expect(result.errors).toBeUndefined();
      const data: any = result.data;
      // The oldest entry after each cursor: the second of each category.
      expect(data.live.logs.map((l: any) => l.message)).toEqual(["gql-seq-b"]);
      expect(data.live.emissions.map((e: any) => e.payload)).toEqual(["b"]);
      expect(data.live.errors.map((e: any) => e.message)).toEqual([
        "gql-seq-b",
      ]);
      expect(data.live.runs.map((r: any) => r.nodeId)).toEqual([
        "gql-seq-node-b",
      ]);
      expect(data.live.logs[0].sequence).toBeGreaterThan(cursors.log);
      expect(data.live.emissions[0].sequence).toBeGreaterThan(cursors.emission);
      expect(data.live.errors[0].sequence).toBeGreaterThan(cursors.error);
      expect(data.live.runs[0].sequence).toBeGreaterThan(cursors.run);
    } finally {
      await runtime.dispose();
    }
  });

  test("documents the cursor window semantics on every live list argument", () => {
    const liveType = schema.getType("Live");
    if (!(liveType instanceof GraphQLObjectType)) {
      throw new Error("Live type missing from schema");
    }
    const fields = liveType.getFields();
    for (const name of ["logs", "emissions", "errors", "runs"]) {
      const args = Object.fromEntries(
        fields[name].args.map((arg) => [arg.name, arg])
      );
      expect(String(args.afterSequence.type)).toBe("Float");
      for (const argName of ["last", "afterTimestamp", "afterSequence"]) {
        expect(args[argName].description).toContain(
          "returns the oldest N entries after the cursor (page forward); without a cursor, it returns the most recent N"
        );
      }
    }
  });
});
