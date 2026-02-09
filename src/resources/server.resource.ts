import { globals, resource } from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import type { StartStandaloneServerOptions } from "@apollo/server/standalone";
import { graphql as graphqlResource } from "./graphql-accumulator.resource";
import type { CustomGraphQLContext } from "../schema/context";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { swapManager } from "./swap.resource";
import { expressMiddleware } from "@as-integrations/express5";
import { coverage } from "./coverage.resource";
import express, { Request, Response } from "express";
import type http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { createUiStaticRouter } from "./ui.static";
import { printSchema } from "graphql/utilities/printSchema";
import { createDocsDataRouteHandler } from "./routeHandlers/getDocsData";
import { createDocsServeHandler } from "./routeHandlers/createDocsServeHandler";
import { createLiveStreamHandler } from "./routeHandlers/createLiveStreamHandler";
import { createRequestCorrelationMiddleware } from "./routeHandlers/requestCorrelation";
import voyagerHtml from "./templates/voyager.html";

export interface ServerConfig {
  port?: number;
  host?: string;
  apollo?: StartStandaloneServerOptions<CustomGraphQLContext>;
}

/** The resolved value exposed by the server resource. */
export interface ServerInstance {
  apolloServer: ApolloServer;
  httpServer: http.Server;
  app: express.Express;
}

export const serverResource = resource({
  id: "runner-dev.resources.server",
  meta: {
    title: "HTTP Server",
    description:
      "Express server with GraphQL endpoint, Voyager UI, and static file serving for the Runner-Dev application",
  },
  register: [coverage],
  dependencies: {
    store: globals.resources.store,
    logger: globals.resources.logger,
    introspector,
    live,
    swapManager,
    graphql: graphqlResource,
    coverage,
  },
  async init(
    config: ServerConfig,
    { store, logger, introspector, live, swapManager, graphql, coverage }
  ): Promise<ServerInstance> {
    logger = logger.with({
      source: serverResource.id,
    });
    const server = new ApolloServer({ schema: graphql.getSchema() });
    const port = config.port ?? 1337;
    const host = config.host;
    const _apolloConfig = config.apollo ?? {};

    await server.start();

    const app = express();

    // Wrap every incoming request in an AsyncLocalStorage context with a fresh
    // correlationId so that all logs / emissions / errors within the request
    // automatically receive a traceId — even outside task execution.
    app.use(createRequestCorrelationMiddleware());

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
            coverage,
          };
        },
      })
    );

    // SSE endpoint for live telemetry streaming
    app.get("/live/stream", createLiveStreamHandler({ live }));

    // Voyager UI at /voyager (simple CDN-based standalone page)
    app.get("/voyager", (_req: Request, res: Response) => {
      const html = voyagerHtml;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    });

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
    const baseHost =
      host && host !== "0.0.0.0" && host !== "::" ? host : "localhost";
    const baseUrl = `http://${baseHost}:${port}`;
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
        coverage,
        getGraphqlSdl: () => printSchema(graphql.getSchema()),
      })
    );

    // Serve minimal HTML for /docs that loads the built docs entry from the Vite manifest
    app.get("/docs", createDocsServeHandler(uiDir, logger));

    // Convenience redirect
    app.get("/", (_req: Request, res: Response) => res.redirect("/voyager"));

    let _resolve, _reject;
    const _promise = new Promise((__resolve, __reject) => {
      _resolve = __resolve;
      _reject = __reject;
    });

    const listenCallback = (e: Error | undefined) => {
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
    };

    const httpServer = host
      ? await app.listen(port, host, listenCallback)
      : await app.listen(port, listenCallback);

    httpServer.on("error", (err: Error) => {
      logger.error("Server error", {
        error: err,
        source: serverResource.id,
      });
    });

    return { apolloServer: server, httpServer, app };
  },
  async dispose(instance: ServerInstance) {
    console.log("Disposing server");
    await instance.apolloServer.stop();
    await new Promise<void>((resolve) =>
      instance.httpServer.close(() => resolve())
    );
  },
});
