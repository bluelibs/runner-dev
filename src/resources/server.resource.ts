import { globals, resource } from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import {
  startStandaloneServer,
  StartStandaloneServerOptions,
} from "@apollo/server/standalone";
import { schema } from "../schema";
import type { CustomGraphQLContext } from "../graphql/context";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";

export interface ServerConfig {
  port?: number;
  apollo?: StartStandaloneServerOptions<CustomGraphQLContext>;
}

export const server = resource({
  id: "server",
  dependencies: {
    store: globals.resources.store,
    logger: globals.resources.logger,
    introspector,
    live,
  },
  async init(config: ServerConfig, { store, logger, introspector, live }) {
    const server = new ApolloServer({ schema });
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
        };
      },
      ...apolloConfig,
    });

    logger.info(`🚀 Runner Dev GraphQL Server ready at ${url}`);
  },
});
