import { resources as runnerResources, run } from "@bluelibs/runner";
import fs from "node:fs/promises";
import path from "node:path";
import { printSchema } from "graphql/utilities/printSchema";
import { buildDocsPagePayload } from "./resources/docsPayload";
import { createRunnerDevGraphqlSchema } from "./resources/graphql-accumulator.resource";
import { Introspector } from "./resources/models/Introspector";
import {
  renderStandaloneDocsHtml,
  resolveDocsBuildAssets,
} from "./resources/docsUiAssets";

export type ExportDocsOptions = {
  output?: string;
  overwrite?: boolean;
};

export type ExportDocsResult = {
  outputDir: string;
  entryHtmlPath: string;
  snapshotPath: string;
};

function resolveOutputDir(output?: string): string {
  const resolved = output ?? "./runner-dev-catalog";
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
}

function isDefaultOutputDir(outputDir: string): boolean {
  return outputDir === resolveOutputDir("./runner-dev-catalog");
}

function isDangerousOutputDir(outputDir: string): boolean {
  const cwd = path.resolve(process.cwd());
  const parentDir = path.resolve(cwd, "..");
  const homeDir = path.resolve(process.env.HOME || "~");
  const rootDir = path.parse(outputDir).root;

  return [cwd, parentDir, homeDir, rootDir].includes(outputDir);
}

async function assertOutputDirIsSafe(
  outputDir: string,
  options: ExportDocsOptions
): Promise<void> {
  if (isDangerousOutputDir(outputDir)) {
    throw new Error(
      `Refusing to export Runner-Dev docs into '${outputDir}' because that path is too broad. Pick a dedicated directory instead.`
    );
  }

  let entries: string[] | null = null;
  try {
    entries = await fs.readdir(outputDir);
  } catch {
    return;
  }

  if (entries.length === 0) {
    return;
  }

  const canOverwrite =
    options.overwrite === true || isDefaultOutputDir(outputDir);

  if (!canOverwrite) {
    throw new Error(
      `Refusing to overwrite the non-empty export directory '${outputDir}'. Pass { overwrite: true } or choose a dedicated path.`
    );
  }
}

export async function exportDocs(
  app: unknown,
  options: ExportDocsOptions = {}
): Promise<ExportDocsResult> {
  const outputDir = resolveOutputDir(options.output);
  const entryHtmlPath = path.join(outputDir, "index.html");
  const snapshotPath = path.join(outputDir, "snapshot.json");

  const uiAssets = await resolveDocsBuildAssets();
  const dryRuntime = await run(app as any, {
    dryRun: true,
    logs: { printThreshold: null },
  });

  try {
    const store = await dryRuntime.getResourceValue(runnerResources.store);
    const runtime = await dryRuntime.getResourceValue(runnerResources.runtime);
    const introspector = new Introspector({ store, runtime });
    const graphqlSdl = printSchema(createRunnerDevGraphqlSchema());

    const payload = await buildDocsPagePayload({
      store,
      introspector,
      mode: "catalog",
      getGraphqlSdl: () => graphqlSdl,
    });

    if (!payload.graphqlSdl || payload.graphqlSdl.trim().length === 0) {
      throw new Error(
        "Runner-Dev export could not generate graphqlSdl for the snapshot payload."
      );
    }

    await assertOutputDirIsSafe(outputDir, options);
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(outputDir), { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
    await fs.writeFile(
      entryHtmlPath,
      await renderStandaloneDocsHtml({
        uiDir: uiAssets.uiDir,
        entry: uiAssets.entry,
        payload,
      }),
      "utf8"
    );

    return {
      outputDir,
      entryHtmlPath,
      snapshotPath,
    };
  } finally {
    try {
      await dryRuntime.dispose();
    } catch {
      /* best-effort cleanup */
    }
  }
}
