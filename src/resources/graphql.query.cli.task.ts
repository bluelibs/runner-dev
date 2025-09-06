import { task, globals } from "@bluelibs/runner";
import { z } from "zod";
import { introspectorCli } from "./introspector.cli.resource";
import { cliConfig } from "./cli.config.resource";
import { live } from "./live.resource";
import { swapManagerCli } from "./swap.cli.resource";
import { graphql as graphqlResource } from "./graphql-accumulator.resource";
import { graphql as executeGraphQL } from "graphql";

type Variables = Record<string, unknown> | undefined;

export const graphqlQueryCliTask = task({
  id: "runner-dev.tasks.graphqlQueryCli",
  meta: {
    title: "Execute GraphQL Query (CLI)",
    description:
      "Runs a GraphQL query against the in-memory schema using CLI-provided Store.",
  },
  dependencies: {
    cli: cliConfig,
    logger: globals.resources.logger,
    introspector: introspectorCli,
    live,
    swapManager: swapManagerCli,
    graphql: graphqlResource,
  },
  inputSchema: z.object({
    query: z.string().min(1, "Query is required"),
    variables: z.record(z.string(), z.unknown()).optional(),
    operationName: z.string().optional(),
  }),
  async run(
    input: { query: string; variables?: Variables; operationName?: string },
    { cli, logger, introspector, live, swapManager, graphql }
  ) {
    const schema = graphql.getSchema();
    const contextValue = {
      store: cli.store,
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
