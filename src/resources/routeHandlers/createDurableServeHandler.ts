import path from "node:path";
import type { Logger } from "@bluelibs/runner";
import type { Request, Response } from "express";
import { readDocsBuildEntry } from "../docsUiAssets";

export function createDurableServeHandler(uiDir: string, logger: Logger) {
  return async (_req: Request, res: Response) => {
    try {
      const entry = await readDocsBuildEntry(path.join(uiDir, "durable"));
      const styles = (entry.css ?? [])
        .map((file) => `<link rel="stylesheet" href="/durable/${file}">`)
        .join("");
      res
        .type("html")
        .send(
          `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Runner Dev · Durable Workflows</title><link rel="icon" href="/docs/favicon.ico">${styles}</head><body><div id="root"></div><script type="module" src="/durable/${entry.file}"></script></body></html>`
        );
    } catch (error) {
      logger.warn("Durable dashboard assets are unavailable", { error });
      res
        .status(503)
        .type("html")
        .send(
          "Durable dashboard assets are unavailable. Build the Runner Dev UI and try again."
        );
    }
  };
}
