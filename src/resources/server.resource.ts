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
import fs from "node:fs/promises";
import { createUiStaticRouter } from "./ui.static";
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

    // Static UI (Vite build) + runtime JS placeholder injection
    const uiDir = path.resolve(__dirname, "../ui");
    app.use(createUiStaticRouter(uiDir));

    // Optional SPA fallback
    // app.get(/^(?!\/graphql|\/voyager|\/docs).*/, (_req, res) => {
    //   res.sendFile(path.join(uiDir, "index.html"));
    // });

    // React SSR + Hydration for /docs
    app.get("/docs", async (req: express.Request, res: express.Response) => {
      const namespacePrefix = req.query.namespace as string | undefined;
      const message = namespacePrefix
        ? ""
        : ` with namespace: ${namespacePrefix}`;
      logger.info(
        `Rendering documentation${message}. Use ?namespace=app to filter elements by id.`
      );
      // Prepare data for hydration
      const data = {
        tasks: introspector.getTasks(),
        resources: introspector.getResources(),
        events: introspector.getEvents(),
        hooks: introspector.getHooks(),
        middlewares: introspector.getMiddlewares(),
        tags: introspector.getAllTags(),
        diagnostics: introspector.getDiagnostics(),
        orphanEvents: introspector.getOrphanEvents(),
        unemittedEvents: introspector.getUnemittedEvents(),
        unusedMiddleware: introspector.getUnusedMiddleware(),
        missingFiles: introspector.getMissingFiles(),
        overrideConflicts: introspector.getOverrideConflicts(),
      };

      const component = React.createElement(Documentation as any, {
        introspector: {
          getTasks: () => data.tasks,
          getResources: () => data.resources,
          getEvents: () => data.events,
          getHooks: () => data.hooks,
          getMiddlewares: () => data.middlewares,
          getAllTags: () => data.tags,
          getDiagnostics: () => data.diagnostics,
          getOrphanEvents: () => data.orphanEvents,
          getUnemittedEvents: () => data.unemittedEvents,
          getUnusedMiddleware: () => data.unusedMiddleware,
          getMissingFiles: () => data.missingFiles,
          getOverrideConflicts: () => data.overrideConflicts,
        } as any,
        namespacePrefix,
      });

      // Load Vite manifest to locate hydration script
      let scripts: string[] = [];
      try {
        const manifestPath = path.resolve(uiDir, "manifest.json");
        const manifestRaw = await fs.readFile(manifestPath, "utf8");
        const manifest = JSON.parse(manifestRaw);
        const entry = manifest["src/hydrate-docs.tsx"]; // keyed by input path
        if (entry?.file) {
          scripts.push(`./${entry.file}`);
          if (Array.isArray(entry.css)) {
            // Optional: could inject CSS via stylesheets option if needed
          }
        }
      } catch (e) {
        logger.warn?.(
          "Vite manifest not found or unreadable, hydration script may be missing"
        );
      }

      const inlineScript = `window.__DOCS_PROPS__ = ${JSON.stringify({
        namespacePrefix,
        introspectorData: data,
      })}`;

      const html = renderReactToString(component, {
        title: "Runner Dev React SSR",
        meta: {
          description: "Server-side rendered React component in Runner Dev",
          author: "BlueLibs Runner Dev",
        },
        scripts,
        inlineScript,
      });

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    });

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
        const baseUrl = `http://localhost:${port}`;
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
