import { globals, resource } from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import type { StartStandaloneServerOptions } from "@apollo/server/standalone";
import { graphql as graphqlResource } from "./graphql-accumulator.resource";
import type { CustomGraphQLContext } from "../schema/context";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { swapManager } from "./swap.resource";
import { expressMiddleware } from "@as-integrations/express5";
import express, { Request, Response } from "express";
import { express as voyagerMiddleware } from "graphql-voyager/middleware";
import { printSchema } from "graphql/utilities/printSchema";
import React from "react";
import {
  renderReactToString,
  renderReactComponentOnly,
} from "../utils/react-ssr";
import { ExampleComponent } from "../components/ExampleComponent";
import { Documentation } from "../components/Documentation";

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

    await server.start();

    const app = express();

    // GraphQL endpoint
    app.use(
      "/graphql",
      express.json(),
      expressMiddleware(server, {
        context: async () => ({
          store,
          logger,
          introspector,
          live,
          swapManager,
        }),
      })
    );

    // Voyager UI at /voyager (points to /graphql)
    app.use("/voyager", voyagerMiddleware({ endpointUrl: "/graphql" }));

    // React SSR endpoints
    app.get("/react", (_req: express.Request, res: express.Response) => {
      const component = React.createElement(Documentation, {
        introspector,
      });

      const html = renderReactToString(component, {
        title: "Runner Dev React SSR",
        meta: {
          description: "Server-side rendered React component in Runner Dev",
          author: "BlueLibs Runner Dev",
        },
      });

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    });

    app.get(
      "/react/component",
      (_req: express.Request, res: express.Response) => {
        const component = React.createElement(ExampleComponent, {
          title: "Component Only",
          message:
            "This returns just the React component HTML without the full document wrapper.",
        });

        const html = renderReactComponentOnly(component);
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      }
    );

    // Convenience redirect
    app.get("/", (_req: Request, res: Response) => res.redirect("/voyager"));

    const httpServer = await app.listen(port, () => {
      const baseUrl = `http://localhost:${port}`;
      logger.info(`🚀 Runner Dev GraphQL Server ready at ${baseUrl}/graphql`);
      logger.info(`🚀 Voyager UI ready at ${baseUrl}/voyager`);
    });

    return { apolloServer: server, httpServer };
  },
  async dispose(instance) {
    console.log("Disposing server");
    await instance.apolloServer.stop();
    await new Promise<void>((resolve) =>
      instance.httpServer.close(() => resolve())
    );
  },
});
