import { run, resource } from "@bluelibs/runner";
import { resources } from "../../index";
import { graphql as executeGraphql, GraphQLString } from "graphql";
import { createDummyApp } from "../dummy/dummyApp";
import { extraQueryFields } from "../../resources/graphql-accumulator.resource";

describe("GraphQL aggregator (registry)", () => {
  test("registry composes extra query fields", async () => {
    let schema: any;

    const plugin = resource({
      id: "probe.graphql-aggregator.plugin",
      dependencies: { graphql: resources.graphql },
      async init(_config, { graphql }) {
        Object.assign(extraQueryFields, {
          ping: { type: GraphQLString, resolve: () => "pong" },
        });
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
      source: "{ ping }",
      // Context can be minimal since our field doesn't use it
      contextValue: {},
    });

    expect(res.errors).toBeUndefined();
    const data: any = res.data;
    expect(data.ping).toBe("pong");

    // no explicit destroy API in tests; runner will tear down between tests
  });
});
