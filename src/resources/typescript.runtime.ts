import type * as TypeScript from "typescript";

export type TypeScriptModule = typeof TypeScript;

/** Features that compile user code and therefore need `typescript`. */
const TYPESCRIPT_FEATURES = "swapTask, eval and shell";
// TypeScript 7 (the native compiler) no longer exposes transpileModule from
// its package entry, so the hint pins the last major line that does.
const TYPESCRIPT_INSTALL_HINT = "Run: npm install --save-dev typescript@6";

export const TYPESCRIPT_MISSING_MESSAGE =
  `Install typescript 5 or 6 to use ${TYPESCRIPT_FEATURES}: they compile ` +
  `code with the "typescript" package, which could not be found. ` +
  TYPESCRIPT_INSTALL_HINT;

export function typescriptIncompatibleMessage(version: string): string {
  return (
    `${TYPESCRIPT_FEATURES} need the TypeScript 5 or 6 compiler API ` +
    `(transpileModule), which the installed "typescript" ${version} does ` +
    `not provide. ${TYPESCRIPT_INSTALL_HINT}`
  );
}

let loadedTypeScript: TypeScriptModule | null = null;

function isTypeScriptNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "MODULE_NOT_FOUND" &&
    error.message.includes("'typescript'")
  );
}

function requireTypeScript(): TypeScriptModule {
  try {
    // A lazy require is the point: a top-level import would make every
    // consumer install typescript just to load the package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const typescript: TypeScriptModule = require("typescript");
    return typescript;
  } catch (error) {
    if (isTypeScriptNotFound(error)) {
      throw new Error(TYPESCRIPT_MISSING_MESSAGE, { cause: error });
    }
    throw error;
  }
}

/**
 * Loads `typescript` on first use instead of at import time.
 *
 * It is an optional peer dependency: the package entry must load without it,
 * and only the features that compile code (swapTask, eval, shell) need it.
 * A missing or incompatible install becomes an actionable error; any other
 * load failure is rethrown untouched so real problems are not disguised.
 */
export function loadTypeScript(): TypeScriptModule {
  if (loadedTypeScript) return loadedTypeScript;
  const typescript = requireTypeScript();
  if (typeof typescript.transpileModule !== "function") {
    // Typed as always present, but an incompatible package may lack it.
    throw new Error(typescriptIncompatibleMessage(typescript.version ?? "?"));
  }
  loadedTypeScript = typescript;
  return typescript;
}
