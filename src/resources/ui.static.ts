import express, { Request, Response, Router } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export function createUiStaticRouter(uiDir: string): Router {
  const router = express.Router();

  const jsCache = new Map<string, string>();

  router.get(/.*\.js$/, async (req: Request, res: Response, next) => {
    try {
      const cleanedPath = req.path.startsWith("/")
        ? req.path.slice(1)
        : req.path;
      const filePath = path.join(uiDir, cleanedPath);
      const cacheKey = `${req.path}:${process.env.API_URL ?? ""}:${
        process.env.OPENAI_API_BASE_URL ?? ""
      }:${process.env.OPENAI_API_KEY ?? ""}`;

      if (jsCache.has(cacheKey)) {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        return res.send(jsCache.get(cacheKey));
      }

      let data = await fs.readFile(filePath, "utf8");

      const replacements: [string, string][] = [
        ["__API_URL__", process.env.API_URL ?? ""],
        ["__OPENAI_API_BASE_URL__", process.env.OPENAI_API_BASE_URL ?? ""],
        ["__OPENAI_API_KEY__", process.env.OPENAI_API_KEY ?? ""],
      ];

      for (const [token, value] of replacements) {
        data = data.split(token).join(JSON.stringify(value));
      }

      jsCache.set(cacheKey, data);
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-store");
      return res.send(data);
    } catch (e) {
      return next();
    }
  });

  router.use(express.static(uiDir, { index: "index.html" }));

  return router;
}
