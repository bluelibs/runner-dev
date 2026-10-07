import express, { Request, Response, Router } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createTextResponse } from "./textResponse";
import {
  applyDocsUiRuntimeReplacements,
  type DocsUiRuntimeConfig,
} from "./docsUiAssets";

/**
 * Maps a request path onto a file inside `rootDir`, or null when it would
 * escape it. `req.path` is not normalized, so a raw request such as
 * `GET /../../app/secret.js` would otherwise read any `.js` file on disk.
 */
export function resolveUiAssetPath(
  rootDir: string,
  requestPath: string
): string | null {
  const root = path.resolve(rootDir);
  // join() normalizes `..` segments, so the prefix check sees the real target.
  const filePath = path.join(root, requestPath);
  return filePath.startsWith(root + path.sep) ? filePath : null;
}

/**
 * Serves the built docs UI. `runtimeConfig.apiUrl` is baked into its scripts
 * as the API base; empty (the default) makes the UI call the origin it was
 * loaded from.
 */
export function createUiStaticRouter(
  uiDir: string,
  runtimeConfig: DocsUiRuntimeConfig = {}
): Router {
  const router = express.Router();

  // Keyed by the resolved file, not the raw request path: many spellings
  // (`/a/../x.js`, `//x.js`) reach one file and must not grow the cache.
  const assetCache = new Map<string, ReturnType<typeof createTextResponse>>();

  router.get(/.*\.(js|css)$/, async (req: Request, res: Response, next) => {
    const filePath = resolveUiAssetPath(uiDir, req.path);
    // Outside the UI directory: let express.static reject it.
    if (!filePath) return next();
    try {
      const cached = assetCache.get(filePath);
      if (cached !== undefined) {
        return await cached(req, res);
      }

      const source = await fs.readFile(filePath, "utf8");
      const isJavaScript = path.extname(filePath) === ".js";
      const data = isJavaScript
        ? applyDocsUiRuntimeReplacements(source, runtimeConfig)
        : source;
      const respond = createTextResponse(
        data,
        isJavaScript ? "application/javascript" : "text/css"
      );
      assetCache.set(filePath, respond);
      return await respond(req, res);
    } catch (_e) {
      return next();
    }
  });

  router.use(express.static(uiDir, { index: "index.html" }));

  return router;
}
