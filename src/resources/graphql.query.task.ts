import { task, globals } from "@bluelibs/runner";
import { z } from "zod";
import { graphql as executeGraphQL } from "graphql";
import { graphql as graphqlResource } from "./graphql-accumulator.resource";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { swapManager } from "./swap.resource";

type Variables = Record<string, unknown> | undefined;

export const graphqlQueryTask = task({
  id: "runner-dev.tasks.graphqlQuery",
  meta: {
    title: "Execute GraphQL Query",
    description:
      "Runs a GraphQL query against the in-memory schema with proper Runner context.",
  },
  dependencies: {
    store: globals.resources.store,
    logger: globals.resources.logger,
    introspector,
    live,
    swapManager,
    graphql: graphqlResource,
  },
  inputSchema: z.object({
    query: z.string().min(1, "Query is required"),
    variables: z.record(z.string(), z.unknown()).optional(),
    operationName: z.string().optional(),
  }),
  async run(
    input: { query: string; variables?: Variables; operationName?: string },
    { store, logger, introspector, live, swapManager, graphql }
  ) {
    const schema = graphql.getSchema();
    const contextValue = {
      store,
      logger,
      introspector,
      live,
      swapManager,
    };

    const result = await executeGraphQL({
      schema,
      source: input.query,
      variableValues: input.variables,
      operationName: input.operationName,
      contextValue,
    });

    return {
      ok: !result.errors || result.errors.length === 0,
      data: result.data ?? null,
      errors: result.errors?.map((e) => e.message) ?? null,
    } as const;
  },
});
