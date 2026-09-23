/**
 * Guards the published runtime (dist/, after `npm run build`) against
 * packages consumers do not get:
 *
 * 1. Every bare `require("pkg")` / `import("pkg")` in dist/**\/*.js must name a
 *    Node builtin, this package, a dependency, a peer dependency, or an entry
 *    of OPTIONAL_RUNTIME_MODULES. dist/ui is skipped: Vite bundles the UI's
 *    own dependencies into it.
 * 2. Loading the package entry ("main") may only reach builtins, dependencies
 *    and required peers. Optional peers (typescript) and optional runtime
 *    modules must load lazily, when a feature needs them; a top-level require
 *    would crash `require("@bluelibs/runner-dev")` for anyone without them.
 */
import { readFile, readdir } from "node:fs/promises";
import Module, { createRequire, isBuiltin } from "node:module";
import path from "node:path";
import process from "node:process";

/**
 * Loaded on demand inside try/catch and never needed to load the package, so
 * they are not declared as dependencies. Each entry says why it is safe.
 */
const OPTIONAL_RUNTIME_MODULES = {
  tsx: "CLI entry loader: optional TypeScript runtime for a project's .ts entry (tries the project's install first, then falls back).",
  "ts-node":
    "CLI entry loader: same optional fallback chain as tsx, used when tsx is missing.",
};

const SPECIFIER_PATTERN = /\b(?:require|import)\(\s*(["'])([^"'`]+)\1\s*\)/g;

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

function packageNameOf(specifier) {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
}

function isBareSpecifier(specifier) {
  return !specifier.startsWith(".") && !path.isAbsolute(specifier);
}

async function listRuntimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entryPath === path.join(distDir, "ui")) continue;
      files.push(...(await listRuntimeFiles(entryPath)));
    } else if (entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
  return files;
}

async function findUndeclaredRequires(declaredPackages) {
  const problems = [];
  for (const file of await listRuntimeFiles(distDir)) {
    const source = await readFile(file, "utf8");
    for (const [, , specifier] of source.matchAll(SPECIFIER_PATTERN)) {
      if (!isBareSpecifier(specifier) || isBuiltin(specifier)) continue;
      if (declaredPackages.has(packageNameOf(specifier))) continue;
      problems.push(
        `${path.relative(rootDir, file)} requires "${specifier}", which is not a dependency, peer dependency or documented optional module.`
      );
    }
  }
  return problems;
}

/** Records every bare module our own dist code resolves while loading `entry`. */
function findEagerLoads(entry, loadablePackages) {
  const problems = [];
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    const fromOwnCode = parent?.filename?.startsWith(distDir + path.sep);
    if (fromOwnCode && isBareSpecifier(request) && !isBuiltin(request)) {
      if (!loadablePackages.has(packageNameOf(request))) {
        problems.push(
          `Loading the package entry requires "${request}" (from ${path.relative(
            rootDir,
            parent.filename
          )}); load it lazily or make it a dependency.`
        );
      }
    }
    return originalResolve.call(this, request, parent, ...rest);
  };
  try {
    createRequire(import.meta.url)(entry);
  } finally {
    Module._resolveFilename = originalResolve;
  }
  return problems;
}

async function main() {
  const pkg = JSON.parse(
    await readFile(path.join(rootDir, "package.json"), "utf8")
  );
  const entry = path.join(rootDir, pkg.main);
  try {
    await readFile(entry);
  } catch {
    throw new Error(`${pkg.main} is missing: run "npm run build" first.`);
  }

  const dependencies = Object.keys(pkg.dependencies ?? {});
  const peers = Object.keys(pkg.peerDependencies ?? {});
  const optionalPeers = new Set(
    Object.entries(pkg.peerDependenciesMeta ?? {})
      .filter(([, meta]) => meta?.optional === true)
      .map(([name]) => name)
  );
  const declaredPackages = new Set([
    pkg.name,
    ...dependencies,
    ...peers,
    ...Object.keys(OPTIONAL_RUNTIME_MODULES),
  ]);
  const loadablePackages = new Set([
    pkg.name,
    ...dependencies,
    ...peers.filter((name) => !optionalPeers.has(name)),
  ]);

  const problems = [
    ...(await findUndeclaredRequires(declaredPackages)),
    ...findEagerLoads(entry, loadablePackages),
  ];

  if (problems.length > 0) {
    console.error("[runtime-deps] dist requires packages consumers may not have:\n");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log(
    `[runtime-deps] dist only requires builtins and declared packages; ${pkg.main} loads without optional ones.`
  );
  // The loaded entry may leave handles open; the verdict is already in.
  process.exit(0);
}

main().catch((error) => {
  console.error("[runtime-deps] check crashed:");
  console.error(error);
  process.exit(1);
});
