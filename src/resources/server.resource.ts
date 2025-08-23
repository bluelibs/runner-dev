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
import path from "node:path";
import fs from "node:fs";
import { createUiStaticRouter } from "./ui.static";
import { express as voyagerMiddleware } from "graphql-voyager/middleware";
import { printSchema } from "graphql/utilities/printSchema";
import { createDocsDataRouteHandler } from "./routeHandlers/getDocsData";
import { createDocsServeHandler } from "./routeHandlers/createDocsServeHandler";

export interface ServerConfig {
  port?: number;
  apollo?: StartStandaloneServerOptions<CustomGraphQLContext>;
}

export const serverResource = resource({
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
    logger = logger.with({
      source: serverResource.id,
    });
    const server = new ApolloServer({ schema: graphql.getSchema() });
    const port = config.port ?? 1337;
    const apolloConfig = config.apollo ?? {};

    await server.start();

    const app = express();

    // GraphQL endpoint
    app.use(
      "/graphql",
      express.json(),
      (req: Request, res: Response, next: any) => {
        // logger.debug("GraphQL request", req.body);
        next();
      },
      expressMiddleware(server, {
        context: async () => {
          return {
            store,
            logger,
            introspector,
            live,
            swapManager,
          };
        },
      })
    );

    // Voyager UI at /voyager (points to /graphql)
    app.use("/voyager", voyagerMiddleware({ endpointUrl: "/graphql" }));

    // Static UI (Vite build output) + runtime JS placeholder injection
    // Vite builds to dist/ui (see src/ui/vite.config.ts)
    // When used as a dependency, process.cwd() may not point to this package root.
    // Try multiple candidate locations to find the built UI assets.
    const candidateUiDirs = [
      path.resolve(process.cwd(), "./dist/ui"),
      // Fallback to package-relative path (from compiled JS, __dirname points to dist/resources)
      path.resolve(__dirname, "../../dist/ui"),
    ];
    const uiDir =
      candidateUiDirs.find((dir) => fs.existsSync(dir)) || candidateUiDirs[0];

    // Compute base URL and expose via token replacement in JS
    const baseUrl = `http://localhost:${port}`;
    process.env.API_URL = process.env.API_URL || baseUrl;

    app.use(createUiStaticRouter(uiDir));

    // Optional SPA fallback
    // app.get(/^(?!\/graphql|\/voyager|\/docs).*/, (_req, res) => {
    //   res.sendFile(path.join(uiDir, "index.html"));
    // });

    // Serve docs data as JSON for client-side rendering
    app.get(
      "/docs/data",
      createDocsDataRouteHandler({
        uiDir,
        store,
        introspector,
        logger,
      })
    );

    // Serve minimal HTML for /docs that loads the built docs entry from the Vite manifest
    app.get("/docs", createDocsServeHandler(uiDir, logger));

    // Convenience redirect
    app.get("/", (_req: Request, res: Response) => res.redirect("/voyager"));

    let resolve, reject;
    const promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    const httpServer = await app.listen(port, (e) => {
      if (e) {
        logger.error("Server error", {
          error: e,
          source: serverResource.id,
        });
      } else {
        logger.info(`GraphQL Server ready at ${baseUrl}/graphql`);
        logger.info(`Voyager UI ready at ${baseUrl}/voyager`);
        logger.info(`Project Documentation ready at ${baseUrl}/docs`);
      }
    });

    httpServer.on("error", (err) => {
      logger.error("Server error", {
        error: err,
        source: serverResource.id,
      });
    });

    return { apolloServer: server, httpServer, app };
  },
  async dispose(instance) {
    console.log("Disposing server");
    await instance.apolloServer.stop();
    await new Promise<void>((resolve) =>
      instance.httpServer.close(() => resolve())
    );
  },
});
