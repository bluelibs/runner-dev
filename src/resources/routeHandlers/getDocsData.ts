import express from "express";
import type { Store } from "@bluelibs/runner";
import { buildDocsPagePayload } from "../docsPayload";
import { Introspector } from "../models/Introspector";

export interface DocsRouteConfig {
  store: Store;
  introspector: Introspector;
  logger: {
    info: (message: string) => void;
    warn?: (message: string) => void;
  };
  // Optional provider to obtain GraphQL SDL string
  getGraphqlSdl?: () => string;
  // Optional coverage service to pre-populate element coverage percentage
  coverage?: {
    getSummaryForPath: (
      p: string | null | undefined
    ) => Promise<{ percentage?: number | null } | null>;
  };
}

// Serve JSON data for docs UI to fetch client-side
export function createDocsDataRouteHandler(config: DocsRouteConfig) {
  return async (req: express.Request, res: express.Response) => {
    const { introspector, logger } = config;
    const namespacePrefix = req.query.namespace as string | undefined;

    const message = namespacePrefix
      ? ` with namespace: ${namespacePrefix}`
      : "";
    logger.info(`Serving documentation data${message}.`);

    const payload = await buildDocsPagePayload({
      store: config.store,
      introspector,
      namespacePrefix,
      mode: "live",
      logger,
      coverage: config.coverage,
      getGraphqlSdl: config.getGraphqlSdl,
    });

    res.setHeader("Content-Type", "application/json");
    res.json(payload);
  };
}
