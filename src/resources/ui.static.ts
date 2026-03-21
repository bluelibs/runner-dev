import express, { Request, Response, Router } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { applyDocsUiRuntimeReplacements } from "./docsUiAssets";

export function createUiStaticRouter(uiDir: string): Router {
  const router = express.Router();

  const jsCache = new Map<string, string>();

  router.get(/.*\.js$/, async (req: Request, res: Response, next) => {
    try {
      const cleanedPath = req.path.startsWith("/")
        ? req.path.slice(1)
        : req.path;
      const filePath = path.join(uiDir, cleanedPath);
      const cacheKey = `${req.path}:${process.env.API_URL ?? ""}`;
      // [AI-CHAT-DISABLED] OpenAI env injection disabled
      // `:${process.env.OPENAI_API_BASE_URL ?? ""}:${process.env.OPENAI_API_KEY ?? ""}`

      if (jsCache.has(cacheKey)) {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        return res.send(jsCache.get(cacheKey));
      }

      let data = await fs.readFile(filePath, "utf8");

      data = applyDocsUiRuntimeReplacements(data, {
        apiUrl: process.env.API_URL ?? "",
      });

      jsCache.set(cacheKey, data);
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-store");
      return res.send(data);
    } catch (_e) {
      return next();
    }
  });

  router.use(express.static(uiDir, { index: "index.html" }));

  return router;
}
