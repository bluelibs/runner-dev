import { resources, defineResource, type Logger } from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
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
import { LiveStreamRegistry } from "./routeHandlers/liveStreamRegistry";
import { createRequestCorrelationMiddleware } from "./routeHandlers/requestCorrelation";
import {
  DEFAULT_BIND_HOST,
  createHostGuard,
  isLoopbackAddress,
} from "./routeHandlers/hostGuard";
import { isCodeExecutionAllowed } from "../schema/codeExecutionGate";
import { allowedHostsSchema } from "./allowedHosts.schema";
import { closeHttpServer } from "./httpServerShutdown";
import voyagerHtml from "./templates/voyager.html";
import z from "zod";

export interface ServerConfig {
  port?: number;
  /**
   * Interface to listen on. Defaults to 127.0.0.1 (this machine only). Set
   * e.g. "0.0.0.0" to expose the server on the network.
   */
  host?: string;
  /**
   * DNS names requests may address the server by, besides `localhost`, IP
   * addresses and `host` itself. Every other Host header gets a 403 (DNS
   * rebinding guard), whatever interface the server listens on.
   */
  allowedHosts?: string[];
  apollo?: StartStandaloneServerOptions<CustomGraphQLContext>;
}

/**
 * `resources.server.with(...)` is a documented entry point next to
 * `dev.with(...)`, so it rejects the same `allowedHosts` entries. The other
 * fields are only type-checked, as before.
 */
const serverConfigSchema: z.ZodType<ServerConfig> = z.object({
  port: z.number().optional(),
  host: z.string().optional(),
  allowedHosts: allowedHostsSchema,
  apollo: z
    .custom<StartStandaloneServerOptions<CustomGraphQLContext>>()
    .optional(),
});

function networkExposureWarning(host: string): string {
  return (
    `Code execution endpoints (shell, eval, swapTask, evalInput) are reachable ` +
    `from the network: the server listens on ${host} and code execution is ` +
    `enabled (RUNNER_DEV_EVAL=1 or NODE_ENV=development/test). Only do this on ` +
    `a trusted network, or omit "host" to listen on ${DEFAULT_BIND_HOST}.`
  );
}

/**
 * Warns once the socket is bound. The bound address, not the configured
 * string, decides: Node accepts many spellings of loopback (`127.1`,
 * `0:0:0:0:0:0:0:1`), and only the resolved address says which one it is.
 */
function warnWhenCodeExecutionIsExposed(
  httpServer: http.Server,
  host: string,
  logger: Logger
): void {
  const address = httpServer.address();
  if (address === null || typeof address === "string") return;
  if (isLoopbackAddress(address.address) || !isCodeExecutionAllowed()) return;
  logger.warn(networkExposureWarning(host));
}

/** The resolved value exposed by the server resource. */
export interface ServerInstance {
  apolloServer: ApolloServer;
  httpServer: http.Server;
  app: express.Express;
}

export const serverResource = defineResource({
  id: "server",
  meta: {
    title: "HTTP Server",
    description:
      "Express server with GraphQL endpoint, Voyager UI, and static file serving for the Runner-Dev application",
  },
  register: [coverage],
  configSchema: serverConfigSchema,
  context: () => ({ liveStreams: new LiveStreamRegistry() }),
  dependencies: {
    store: resources.store,
    logger: resources.logger,
    introspector,
    live,
    swapManager,
    graphql: graphqlResource,
    coverage,
  },
  async init(
    config: ServerConfig,
    { store, logger, introspector, live, swapManager, graphql, coverage },
    { liveStreams }
  ): Promise<ServerInstance> {
    logger = logger.with({
      source: serverResource.id,
    });
    const server = new ApolloServer({
      schema: graphql.getSchema(),
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
    });
    const port = config.port ?? 1337;
    const host = config.host ?? DEFAULT_BIND_HOST;
    const _apolloConfig = config.apollo ?? {};

    await server.start();

    const app = express();

    // Guard first so every route, including http-tagged task routes added
    // later, sits behind it. It runs on every bind: a network bind is still
    // reachable from the developer's own browser (e.g. a Docker port
    // published on 127.0.0.1), which is exactly where DNS rebinding strikes.
    app.use(
      createHostGuard({ allowedHosts: [host, ...(config.allowedHosts ?? [])] })
    );

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
    app.get(
      "/live/stream",
      createLiveStreamHandler({ live, streams: liveStreams })
    );

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

    // Advertised in the startup logs only. The default loopback bind still
    // says "localhost" (clients resolve it to 127.0.0.1 via happy eyeballs).
    const baseHost =
      config.host && host !== "0.0.0.0" && host !== "::" ? host : "localhost";
    const baseUrl = `http://${baseHost}:${port}`;

    // The docs UI is served by this server, so by default it calls the API
    // on the origin it was loaded from. A URL baked in here would be wrong
    // for any browser that reaches the server under another name or port
    // (a LAN address, a remapped Docker port). API_URL stays an override.
    app.use(createUiStaticRouter(uiDir, { apiUrl: process.env.API_URL ?? "" }));

    // Optional SPA fallback
    // app.get(/^(?!\/graphql|\/voyager|\/docs).*/, (_req, res) => {
    //   res.sendFile(path.join(uiDir, "index.html"));
    // });

    // Serve docs data as JSON for client-side rendering
    app.get(
      "/docs/data",
      createDocsDataRouteHandler({
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

    const httpServer = app.listen(port, host, listenCallback);
    httpServer.once("listening", () =>
      warnWhenCodeExecutionIsExposed(httpServer, host, logger)
    );

    httpServer.on("error", (err: Error) => {
      logger.error("Server error", {
        error: err,
        source: serverResource.id,
      });
    });

    return { apolloServer: server, httpServer, app };
  },
  async dispose(instance: ServerInstance, _config, _deps, { liveStreams }) {
    console.log("Disposing server");
    await instance.apolloServer.stop();
    // close() waits for every open connection, and an event stream never
    // finishes by itself: end them first or shutdown hangs while a docs tab
    // shows the Live panel.
    liveStreams.endAll();
    await closeHttpServer(instance.httpServer);
  },
});
