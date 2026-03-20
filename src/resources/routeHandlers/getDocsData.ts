import express from "express";
import { Introspector } from "../models/Introspector";
import { Store } from "@bluelibs/runner";
import { initializeFromStore } from "../models/initializeFromStore";
import fs from "node:fs/promises";
import path from "node:path";
import {
  readFirstAvailablePackageDoc,
  readPackageDoc,
  RUNNER_FRAMEWORK_COMPACT_DOC_PATHS,
  RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS,
} from "../../docs/packageDocs";
import { findDurableResourceIdFromStore } from "../models/durable.runtime";

export interface DocsContentPayload {
  minimalMd: string;
  completeMd: string;
}

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
  // Optional coverage service to pre-populate element coverage percentage
  coverage?: {
    getSummaryForPath: (
      p: string | null | undefined
    ) => Promise<{ percentage?: number | null } | null>;
  };
}

async function readDocsContent(): Promise<DocsContentPayload> {
  const [minimalDoc, completeDoc] = await Promise.all([
    readFirstAvailablePackageDoc("@bluelibs/runner", [
      ...RUNNER_FRAMEWORK_COMPACT_DOC_PATHS,
    ]),
    readFirstAvailablePackageDoc("@bluelibs/runner", [
      ...RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS,
    ]),
  ]);
  const minimalMd = minimalDoc.content;
  const completeMd = completeDoc.content;

  return {
    minimalMd,
    completeMd,
  };
}

async function readRunnerDevCompactGuide(): Promise<string> {
  const packageDoc = await readPackageDoc(
    "@bluelibs/runner-dev",
    "skills/core/references/readmes/COMPACT_GUIDE.md"
  );
  if (packageDoc.content) {
    return packageDoc.content;
  }

  const localFallbackPath = path.resolve(
    __dirname,
    "../../../skills/core/references/readmes/COMPACT_GUIDE.md"
  );
  let localFallback: string;
  try {
    localFallback = await fs.readFile(localFallbackPath, "utf8");
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown filesystem error";
    throw new Error(
      `Runner-Dev compact guide could not be read at ${localFallbackPath}: ${reason}`
    );
  }
  if (!localFallback) {
    throw new Error(
      `Runner-Dev compact guide is empty at ${localFallbackPath}.`
    );
  }

  return localFallback;
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

    // Enrich tasks with durable metadata for docs UI.
    if (Array.isArray((data as any).tasks)) {
      for (const task of (data as any).tasks) {
        const taskId = String(task?.id || "");
        if (!taskId) continue;

        const isDurable = introspector.isDurableTask(taskId);
        const dependencyIds = Array.isArray(task?.dependsOn)
          ? task.dependsOn.map((depId: unknown) => String(depId))
          : [];

        task.isDurable = isDurable;
        task.durableResourceId = isDurable
          ? findDurableResourceIdFromStore(
              config.store,
              taskId,
              dependencyIds
            ) ||
            introspector.getDurableResourceForTask(taskId)?.id ||
            null
          : null;
        task.flowShape = null;
      }
    }

    // Attach pre-fetched coverage percentages when coverage is available.
    if (config.coverage) {
      const attach = async (
        arr: Array<{ filePath?: string | null; coverage?: any }>
      ) => {
        for (const el of arr) {
          try {
            const s = await config.coverage!.getSummaryForPath(
              el.filePath || null
            );
            if (s && typeof s.percentage === "number") {
              (el as any).coverage = { percentage: s.percentage };
            }
          } catch {
            /* best-effort coverage attachment */
          }
        }
      };

      try {
        await attach((data as any).tasks || []);
        await attach((data as any).resources || []);
        await attach((data as any).hooks || []);
        await attach((data as any).middlewares || []);
        await attach((data as any).events || []);
      } catch {
        /* best-effort coverage attachment */
      }
    }

    const docsContent = await readDocsContent();
    const runnerFrameworkMd = docsContent.minimalMd;
    const runnerDevMd = await readRunnerDevCompactGuide();

    // Obtain GraphQL SDL if available
    let graphqlSdl: string | undefined;
    try {
      graphqlSdl = config.getGraphqlSdl?.();
    } catch (_e) {
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
    } catch {
      /* best-effort overview generation */
    }
    const projectOverviewMd = overviewLines.join("\n");

    res.setHeader("Content-Type", "application/json");
    res.json({
      namespacePrefix,
      introspectorData: data,
      runnerFrameworkMd,
      runnerDevMd,
      docsContent,
      projectOverviewMd,
      graphqlSdl,
    });
  };
}
