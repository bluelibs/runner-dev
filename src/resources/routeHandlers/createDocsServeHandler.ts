import { Logger } from "@bluelibs/runner";
import { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "path";

export function createDocsServeHandler(uiDir: string, logger: Logger) {
  return async (_req: Request, res: Response) => {
    let moduleScriptHref: string | undefined;
    let stylesheetHrefs: string[] = [];
    try {
      let manifestRaw: string | undefined;
      const manifestPathVite = path.resolve(uiDir, ".vite/manifest.json");
      try {
        manifestRaw = await fs.readFile(manifestPathVite, "utf8");
      } catch {}
      if (!manifestRaw) {
        const manifestPath = path.resolve(uiDir, "manifest.json");
        manifestRaw = await fs.readFile(manifestPath, "utf8");
      }
      const manifest = JSON.parse(manifestRaw!);
      let entry = manifest["docs"] || manifest["src/hydrate-docs.tsx"];
      if (!entry) {
        entry = Object.values(manifest).find((e: any) => e && e.isEntry);
      }
      if (entry?.file) {
        moduleScriptHref = `/${entry.file}`;
        if (Array.isArray(entry.css)) {
          stylesheetHrefs = entry.css.map((href: string) => `/${href}`);
        }
      }
    } catch (e) {
      logger.warn?.("Vite manifest not found or unreadable for /docs");
    }

    const styles = stylesheetHrefs
      .map((href) => `<link rel=\"stylesheet\" href=\"${href}\">`)
      .join("");
    const scripts = moduleScriptHref
      ? `<script type=\"module\" src=\"${moduleScriptHref}\"></script>`
      : "";
    const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><title>Runner Dev Docs</title>${styles}</head><body><div id=\"root\"></div>${scripts}</body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  };
}
