import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/**
 * Load a JS/TS entry file and return the exported app (default or named export).
 * Tries common TS runtimes (tsx, ts-node) and falls back to CJS require / dynamic import.
 * Returns the selected export or throws a detailed error with hints.
 */
export async function loadEntryExport(
  entryFile: string,
  exportName?: string
): Promise<any> {
  const tsLoaderErrors: string[] = [];

  const abs = path.isAbsolute(entryFile)
    ? entryFile
    : path.resolve(process.cwd(), entryFile);

  // Signal to the loaded entry that we're in CLI dry-run context; projects can opt to skip server start
  if (!process.env.RUNNER_DEV_CLI) process.env.RUNNER_DEV_CLI = "1";
  if (!process.env.RUNNER_DEV_DRY_RUN) process.env.RUNNER_DEV_DRY_RUN = "1";

  // Use a require() instance relative to the entry file's project, so devDeps there are resolvable
  const projectRequire = createRequire(pathToFileURL(abs));

  // Force any top-level run(app) calls inside the target project to be dry-run and silent
  try {
    const runnerPath = projectRequire.resolve("@bluelibs/runner");
    const runnerMod = projectRequire(runnerPath);
    const originalRun = runnerMod?.run as
      | ((app: any, opts?: any) => Promise<any>)
      | undefined;
    if (typeof originalRun === "function") {
      const wrapped = async (app: any, opts?: any) => {
        const merged = {
          ...(opts || {}),
          dryRun: true,
          logs: { printThreshold: null, ...(opts?.logs || {}) },
        };
        return originalRun(app, merged);
      };
      // Patch both the live export and the cache entry exports
      try {
        runnerMod.run = wrapped;
      } catch {}
      try {
        const cache = require.cache[runnerPath];
        if (cache && cache.exports) {
          cache.exports.run = wrapped;
        }
      } catch {}
    }
  } catch {}

  // Try to load a TS runtime relative to the target project first
  let loadedTsRuntime: string | null = null;
  try {
    projectRequire("tsx/cjs");
    loadedTsRuntime = "tsx";
  } catch (e) {
    tsLoaderErrors.push(`tsx (project): ${(e as Error).message}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("tsx/cjs");
      loadedTsRuntime = "tsx";
    } catch (e2) {
      tsLoaderErrors.push(`tsx (local): ${(e2 as Error).message}`);
    }
  }

  if (!loadedTsRuntime) {
    try {
      projectRequire("ts-node/register/transpile-only");
      loadedTsRuntime = "ts-node/transpile-only";
    } catch (e) {
      tsLoaderErrors.push(
        `ts-node/transpile-only (project): ${(e as Error).message}`
      );
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node/register/transpile-only");
        loadedTsRuntime = "ts-node/transpile-only";
      } catch (e2) {
        tsLoaderErrors.push(
          `ts-node/transpile-only (local): ${(e2 as Error).message}`
        );
      }
    }
  }

  if (!loadedTsRuntime) {
    try {
      projectRequire("ts-node/register");
      loadedTsRuntime = "ts-node/register";
    } catch (e) {
      tsLoaderErrors.push(
        `ts-node/register (project): ${(e as Error).message}`
      );
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node/register");
        loadedTsRuntime = "ts-node/register";
      } catch (e2) {
        tsLoaderErrors.push(
          `ts-node/register (local): ${(e2 as Error).message}`
        );
      }
    }
  }

  const isTs = /\.tsx?$/.test(abs);

  // If this is a TS entry and no TS runtime was loaded, fail fast with a clear error
  if (isTs && !loadedTsRuntime) {
    const hints = [
      "Install a TypeScript runtime such as 'tsx' or 'ts-node'",
      'If your project uses ESM, ensure nearest package.json has "type": "module" or use a .mjs extension',
      "Alternatively, run with a compiled JavaScript entry file instead of .ts/.tsx",
    ];
    if (tsLoaderErrors.length > 0) {
      hints.unshift(`TS loader attempts failed: ${tsLoaderErrors.join("; ")}`);
    }
    throw new Error(
      `TypeScript entry detected but no TS runtime was loaded for '${entryFile}'.\nHints:\n- ${hints.join(
        "\n- "
      )}`
    );
  }

  // Try to register tsconfig-paths to support TS path aliases (best-effort)
  if (loadedTsRuntime) {
    try {
      projectRequire("tsconfig-paths/register");
    } catch {}
  }

  const errors: string[] = [];
  let mod: any;

  // Try CJS require first (allows tsx/ts-node hooks), then explicit .ts require, then dynamic import
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require(abs);
  } catch (e) {
    errors.push(`require(${abs}): ${(e as Error).message}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require(abs.endsWith(".ts") ? abs : `${abs}.ts`);
    } catch (e2) {
      errors.push(`require(${abs}.ts): ${(e2 as Error).message}`);
      try {
        mod = await import(pathToFileURL(abs).href);
      } catch (e3) {
        errors.push(`import(${abs}): ${(e3 as Error).message}`);
      }
    }
  }

  if (!mod) {
    const hints = [
      "Install a TypeScript runtime such as 'tsx' or 'ts-node'",
      'If your project uses ESM, ensure nearest package.json has "type": "module" or use a .mjs extension',
      "Try running with --entry-file pointing to a compiled JS file instead",
    ];
    if (tsLoaderErrors.length > 0) {
      hints.unshift(`TS loader attempts failed: ${tsLoaderErrors.join("; ")}`);
    }
    throw new Error(
      `Failed to load entry file '${entryFile}'. Attempts:\n- ${errors.join(
        "\n- "
      )}\nHints:\n- ${hints.join("\n- ")}`
    );
  }

  const entry =
    (exportName ? mod?.[exportName] : mod?.default) ?? mod?.app ?? null;
  if (!entry) {
    throw new Error(
      `Entry not found in '${entryFile}'. Provide a default export or use --export <name>.`
    );
  }
  return entry;
}
