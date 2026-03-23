import { Store } from "@bluelibs/runner";
import fs from "node:fs/promises";
import path from "node:path";
import {
  readFirstAvailablePackageDoc,
  readPackageDoc,
  RUNNER_FRAMEWORK_COMPACT_DOC_PATHS,
  RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS,
} from "../docs/packageDocs";
import {
  Introspector,
  type SerializedIntrospector,
} from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";
import { findDurableResourceIdFromStore } from "./models/durable.runtime";
import { getDurableWorkflowKeyFromTags } from "./models/durable.tools";

export interface DocsContentPayload {
  minimalMd: string;
  completeMd: string;
}

export type DocumentationMode = "live" | "catalog";

export interface DocsPagePayload {
  mode: DocumentationMode;
  namespacePrefix?: string;
  introspectorData: SerializedIntrospector;
  runnerFrameworkMd: string;
  runnerDevMd: string;
  docsContent: DocsContentPayload;
  projectOverviewMd: string;
  graphqlSdl?: string;
}

export interface DocsPayloadConfig {
  store: Store;
  introspector: Introspector;
  namespacePrefix?: string;
  mode?: DocumentationMode;
  logger?: {
    warn?: (message: string) => void;
  };
  getGraphqlSdl?: () => string;
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

  return {
    minimalMd: minimalDoc.content,
    completeMd: completeDoc.content,
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
    "../../skills/core/references/readmes/COMPACT_GUIDE.md"
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

function buildProjectOverviewMarkdown(introspector: Introspector): string {
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

  return overviewLines.join("\n");
}

async function attachCoverage(
  data: SerializedIntrospector,
  coverage: NonNullable<DocsPayloadConfig["coverage"]>
): Promise<void> {
  const attach = async (
    arr: Array<{ filePath?: string | null; coverage?: any }>
  ) => {
    for (const el of arr) {
      try {
        const summary = await coverage.getSummaryForPath(el.filePath || null);
        if (summary && typeof summary.percentage === "number") {
          (el as any).coverage = { percentage: summary.percentage };
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

function enrichDurableTaskMetadata(
  data: SerializedIntrospector,
  introspector: Introspector,
  store: Store
): void {
  if (!Array.isArray((data as any).tasks)) {
    return;
  }

  for (const task of (data as any).tasks) {
    const taskId = String(task?.id || "");
    if (!taskId) continue;

    const isDurable = introspector.isDurableTask(taskId);
    const dependencyIds = Array.isArray(task?.dependsOn)
      ? task.dependsOn.map((depId: unknown) => String(depId))
      : [];

    task.isDurable = isDurable;
    task.durableResourceId = isDurable
      ? findDurableResourceIdFromStore(store, taskId, dependencyIds) ||
        introspector.getDurableResourceForTask(taskId)?.id ||
        null
      : null;
    task.durableWorkflowKey = isDurable
      ? getDurableWorkflowKeyFromTags(task.tagsDetailed || [])
      : null;
  }
}

export async function buildDocsPagePayload(
  config: DocsPayloadConfig
): Promise<DocsPagePayload> {
  const {
    store,
    introspector,
    namespacePrefix,
    logger,
    coverage,
    getGraphqlSdl,
  } = config;

  initializeFromStore(introspector, store);
  const introspectorData = introspector.serialize();

  enrichDurableTaskMetadata(introspectorData, introspector, store);
  if (coverage) {
    await attachCoverage(introspectorData, coverage);
  }

  const docsContent = await readDocsContent();
  const runnerDevMd = await readRunnerDevCompactGuide();

  let graphqlSdl: string | undefined;
  try {
    graphqlSdl = getGraphqlSdl?.();
  } catch {
    logger?.warn?.("Failed to generate GraphQL SDL for docs payload");
  }

  return {
    mode: config.mode ?? "live",
    namespacePrefix,
    introspectorData,
    runnerFrameworkMd: docsContent.minimalMd,
    runnerDevMd,
    docsContent,
    projectOverviewMd: buildProjectOverviewMarkdown(introspector),
    graphqlSdl,
  };
}
