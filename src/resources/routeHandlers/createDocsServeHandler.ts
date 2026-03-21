import { Logger } from "@bluelibs/runner";
import { Request, Response } from "express";
import { readDocsBuildEntry, renderDocsHtml } from "../docsUiAssets";

export function createDocsServeHandler(uiDir: string, logger: Logger) {
  return async (_req: Request, res: Response) => {
    try {
      const entry = await readDocsBuildEntry(uiDir);
      const html = renderDocsHtml(entry, {
        assetPrefix: "/",
        faviconHref: "/docs/favicon.ico",
      });
      res.setHeader("Content-Type", "text/html");
      res.send(html);
      return;
    } catch (_e) {
      logger.warn?.("Vite manifest not found or unreadable for /docs");
    }

    const html = renderDocsHtml(
      { file: "assets/docs.js", css: ["assets/docs.css"] },
      {
        assetPrefix: "/",
        faviconHref: "/docs/favicon.ico",
      }
    );
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  };
}
