import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import React from "react";
import { renderReactToString } from "../utils/react-ssr";
import { Documentation } from "../components/Documentation";

export interface DocsRouteConfig {
  uiDir: string;
  introspector: {
    getTasks: () => any[];
    getResources: () => any[];
    getEvents: () => any[];
    getHooks: () => any[];
    getMiddlewares: () => any[];
    getAllTags: () => any[];
    getDiagnostics: () => any[];
    getOrphanEvents: () => any[];
    getUnemittedEvents: () => any[];
    getUnusedMiddleware: () => any[];
    getMissingFiles: () => any[];
    getOverrideConflicts: () => any[];
  };
  logger: {
    info: (message: string) => void;
    warn?: (message: string) => void;
  };
}

export function createDocsRouteHandler(config: DocsRouteConfig) {
  return async (req: express.Request, res: express.Response) => {
    const { uiDir, introspector, logger } = config;
    const namespacePrefix = req.query.namespace as string | undefined;

    const message = namespacePrefix
      ? ""
      : ` with namespace: ${namespacePrefix}`;
    logger.info(
      `Rendering documentation${message}. Use ?namespace=app to filter elements by id.`
    );

    // Prepare data for hydration
    const data = {
      tasks: introspector.getTasks(),
      resources: introspector.getResources(),
      events: introspector.getEvents(),
      hooks: introspector.getHooks(),
      middlewares: introspector.getMiddlewares(),
      tags: introspector.getAllTags(),
      diagnostics: introspector.getDiagnostics(),
      orphanEvents: introspector.getOrphanEvents(),
      unemittedEvents: introspector.getUnemittedEvents(),
      unusedMiddleware: introspector.getUnusedMiddleware(),
      missingFiles: introspector.getMissingFiles(),
      overrideConflicts: introspector.getOverrideConflicts(),
    };

    const component = React.createElement(Documentation as any, {
      introspector: {
        getTasks: () => data.tasks,
        getResources: () => data.resources,
        getEvents: () => data.events,
        getHooks: () => data.hooks,
        getMiddlewares: () => data.middlewares,
        getAllTags: () => data.tags,
        getDiagnostics: () => data.diagnostics,
        getOrphanEvents: () => data.orphanEvents,
        getUnemittedEvents: () => data.unemittedEvents,
        getUnusedMiddleware: () => data.unusedMiddleware,
        getMissingFiles: () => data.missingFiles,
        getOverrideConflicts: () => data.overrideConflicts,
      } as any,
      namespacePrefix,
    });

    // Load Vite manifest to locate hydration script
    let scripts: string[] = [];
    try {
      const manifestPath = path.resolve(uiDir, "manifest.json");
      const manifestRaw = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(manifestRaw);
      const entry = manifest["src/hydrate-docs.tsx"]; // keyed by input path
      if (entry?.file) {
        scripts.push(`./${entry.file}`);
        if (Array.isArray(entry.css)) {
          // Optional: could inject CSS via stylesheets option if needed
        }
      }
    } catch (e) {
      logger.warn?.(
        "Vite manifest not found or unreadable, hydration script may be missing"
      );
    }

    const inlineScript = `window.__DOCS_PROPS__ = ${JSON.stringify({
      namespacePrefix,
      introspectorData: data,
    })}`;

    const html = renderReactToString(component, {
      title: "Runner Dev React SSR",
      meta: {
        description: "Server-side rendered React component in Runner Dev",
        author: "BlueLibs Runner Dev",
      },
      scripts,
      inlineScript,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  };
}
