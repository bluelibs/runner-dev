import express from "express";
import { Introspector } from "../models/Introspector";
import { Store } from "@bluelibs/runner";
import { initializeFromStore } from "../models/initializeFromStore";

export interface DocsRouteConfig {
  uiDir: string;
  store: Store;
  introspector: Introspector;
  logger: {
    info: (message: string) => void;
    warn?: (message: string) => void;
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
    logger.info(
      `Serving documentation data${message}. Use ?namespace=app to filter elements by id.`
    );

    initializeFromStore(introspector, config.store);
    const data = (introspector as unknown as Introspector).serialize();

    res.setHeader("Content-Type", "application/json");
    res.json({
      namespacePrefix,
      introspectorData: data,
    });
  };
}
