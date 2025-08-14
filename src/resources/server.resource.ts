import { globals, resource } from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import {
  startStandaloneServer,
  StartStandaloneServerOptions,
} from "@apollo/server/standalone";
import { graphql as graphqlResource } from "./graphql-accumulator.resource";
import type { CustomGraphQLContext } from "../schema/context";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { swapManager } from "./swap.resource";

export interface ServerConfig {
  port?: number;
  apollo?: StartStandaloneServerOptions<CustomGraphQLContext>;
}

export const server = resource({
  id: "runner-dev.resources.server",
  dependencies: {
    store: globals.resources.store,
    logger: globals.resources.logger,
    introspector,
    live,
    swapManager,
    graphql: graphqlResource,
  },
  async init(
    config: ServerConfig,
    { store, logger, introspector, live, swapManager, graphql }
  ) {
    const server = new ApolloServer({ schema: graphql.getSchema() });
    const port = config.port ?? 1337;
    const apolloConfig = config.apollo ?? {};

    const { url } = await startStandaloneServer(server, {
      listen: { port },
      context: async () => {
        return {
          store,
          logger,
          introspector,
          live,
          swapManager,
        };
      },
      ...apolloConfig,
    });

    logger.info(`🚀 Runner Dev GraphQL Server ready at ${url}`);
  },
});
