import express from "express";
import type { Store } from "@bluelibs/runner";
import { buildDocsPagePayload } from "../docsPayload";
import { Introspector } from "../models/Introspector";
import { createTextResponse } from "../textResponse";

export interface DocsRouteConfig {
  store: Store;
  introspector: Introspector;
  logger: {
    info: (message: string) => void;
    warn?: (message: string) => void;
  };
  getGraphqlSdl?: () => string;
  coverage?: {
    getSummaryForPath: (
      p: string | null | undefined
    ) => Promise<{ percentage?: number | null } | null>;
  };
}

// Hot swaps and coverage changes become visible within this short window.
const DOCS_CACHE_MS = 5_000;

export function createDocsDataRouteHandler(config: DocsRouteConfig) {
  let cache:
    | {
        namespacePrefix: string | undefined;
        expiresAt: number;
        pending: Promise<ReturnType<typeof createTextResponse>>;
      }
    | undefined;

  return async (req: express.Request, res: express.Response) => {
    const namespacePrefix =
      typeof req.query.namespace === "string" ? req.query.namespace : undefined;
    if (
      !cache ||
      cache.namespacePrefix !== namespacePrefix ||
      Date.now() >= cache.expiresAt
    ) {
      const entry = {
        namespacePrefix,
        expiresAt: Infinity,
        pending: buildDocsPagePayload({
          ...config,
          namespacePrefix,
          mode: "live",
        })
          .then((payload) => {
            const response = createTextResponse(
              JSON.stringify(payload),
              "application/json; charset=utf-8"
            );
            entry.expiresAt = Date.now() + DOCS_CACHE_MS;
            return response;
          })
          .catch((error: unknown) => {
            // Failed builds must not poison subsequent requests.
            if (cache === entry) cache = undefined;
            throw error;
          }),
      };
      cache = entry;
      config.logger.info("Building documentation data.");
    }
    const respond = await cache.pending;
    await respond(req, res);
  };
}
