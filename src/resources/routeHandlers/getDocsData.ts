import express from "express";
import { Introspector } from "../models/Introspector";
import { Store } from "@bluelibs/runner";
import { initializeFromStore } from "../models/initializeFromStore";
import fs from "node:fs/promises";
import path from "node:path";
import { readDocContent, readPackageDoc } from "../../mcp/help";

export interface DocsRouteConfig {
  uiDir: string;
  store: Store;
  introspector: Introspector;
  logger: {
    info: (message: string) => void;
    warn?: (message: string) => void;
  };
  // Optional provider to obtain GraphQL SDL string
  getGraphqlSdl?: () => string;
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

    initializeFromStore(introspector, config.store);
    const data = (introspector as unknown as Introspector).serialize();

    // Try to read framework and runner-dev AI.md from node_modules
    const runnerFrameworkDoc = await readPackageDoc(
      "@bluelibs/runner",
      "AI.md"
    ).catch(() => ({ content: "" } as any));
    let runnerFrameworkAiMd = runnerFrameworkDoc.content || "";

    // Runner-Dev AI.md (when this package is a dependency)
    const runnerDevDoc = await readPackageDoc(
      "@bluelibs/runner-dev",
      "AI.md"
    ).catch(() => ({ content: "" } as any));
    let runnerDevAiMd = runnerDevDoc.content || "";

    // Fallback to package-relative AI.md (when developing this repo)
    if (!runnerDevAiMd) {
      try {
        const fallback = await fs.readFile(
          path.resolve(__dirname, "../../../AI.md"),
          "utf8"
        );
        runnerDevAiMd = fallback || runnerDevAiMd;
      } catch {}
    }

    // Expose framework and dev docs separately
    const runnerFrameworkMd = runnerFrameworkAiMd || "";
    const runnerDevMd = runnerDevAiMd || "";

    // Obtain GraphQL SDL if available
    let graphqlSdl: string | undefined;
    try {
      graphqlSdl = config.getGraphqlSdl?.();
    } catch (e) {
      logger.warn?.("Failed to generate GraphQL SDL for /docs/data");
    }

    // Build a lightweight Project Overview (Markdown) using the in-memory introspector
    const overviewLines: string[] = [];
    try {
      const tasks = introspector.getTasks?.() ?? [];
      const hooks = introspector.getHooks?.() ?? [];
      const resources = introspector.getResources?.() ?? [];
      const middlewares = introspector.getMiddlewares?.() ?? [];
      const events = introspector.getEvents?.() ?? [];

      overviewLines.push(`# Project Overview`);
      overviewLines.push("");
      overviewLines.push(`- Tasks: ${tasks.length}`);
      overviewLines.push(`- Hooks: ${hooks.length}`);
      overviewLines.push(`- Resources: ${resources.length}`);
      overviewLines.push(`- Middleware: ${middlewares.length}`);
      overviewLines.push(`- Events: ${events.length}`);
      overviewLines.push("");

      const sample = <T>(arr: T[], n = 10) => arr.slice(0, n);
      const fmt = (
        id: string,
        title?: string | null,
        description?: string | null
      ) => {
        const lineTitle = title && title.trim().length ? title : id;
        const extra =
          description && description.trim().length ? ` — ${description}` : "";
        return `- ${lineTitle} {${id}}${extra}`;
      };

      if (tasks.length) {
        overviewLines.push(`## Sample Tasks`);
        for (const t of sample(tasks)) {
          const meta = (t as any).meta || {};
          overviewLines.push(
            fmt(String((t as any).id), meta.title, meta.description)
          );
        }
        overviewLines.push("");
      }
      if (resources.length) {
        overviewLines.push(`## Sample Resources`);
        for (const r of sample(resources)) {
          const meta = (r as any).meta || {};
          overviewLines.push(
            fmt(String((r as any).id), meta.title, meta.description)
          );
        }
        overviewLines.push("");
      }
      if (events.length) {
        overviewLines.push(`## Sample Events`);
        for (const e of sample(events)) {
          const meta = (e as any).meta || {};
          overviewLines.push(
            fmt(String((e as any).id), meta.title, meta.description)
          );
        }
        overviewLines.push("");
      }
    } catch {}
    const projectOverviewMd = overviewLines.join("\n");

    res.setHeader("Content-Type", "application/json");
    res.json({
      namespacePrefix,
      introspectorData: data,
      runnerFrameworkMd,
      runnerDevMd,
      projectOverviewMd,
      graphqlSdl,
    });
  };
}
