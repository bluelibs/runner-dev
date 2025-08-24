import { run, resource } from "@bluelibs/runner";
import { resources } from "../../index";
import { graphql as executeGraphql } from "graphql";
import { createDummyApp } from "../dummy/dummyApp";
// extensibility via extraQueryFields was removed; this test now asserts base schema exists

describe("GraphQL aggregator (registry)", () => {
  test("registry builds base schema (no extension hooks)", async () => {
    let schema: any;

    const plugin = resource({
      id: "probe.graphql-aggregator.plugin",
      dependencies: { graphql: resources.graphql },
      async init(_config, { graphql }) {
        schema = graphql.getSchema();
      },
    });

    const app = createDummyApp([
      resources.introspector,
      resources.live,
      resources.swapManager,
      resources.graphql,
      plugin,
    ]);
    await run(app);

    const res = await executeGraphql({
      schema,
      source: "{ __typename }",
      contextValue: {},
    });

    expect(res.errors).toBeUndefined();
    const data = (res.data ?? undefined) as Record<string, unknown> | undefined;
    expect(data?.["__typename"]).toBe("Query");

    // Ensure mutations exist and include editFile
    const mutationFields = schema.getMutationType()?.getFields?.();
    expect(mutationFields).toBeDefined();
    expect(Object.keys(mutationFields || {})).toContain("editFile");
  });
});
