import fs from "node:fs/promises";
import path from "node:path";
import { sanitizePath } from "../utils/path";

export const RUNNER_FRAMEWORK_COMPACT_DOC_PATHS = [
  "readmes/COMPACT_GUIDE.md",
] as const;

export const RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS = [
  "readmes/FULL_GUIDE.md",
] as const;

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i;
const PACKAGE_DOC_ROOTS_BY_PACKAGE: Record<string, string[]> = {
  "@bluelibs/runner": [
    ".agents/skills/bluelibs-runner-core/references",
    "node_modules/@bluelibs/runner",
  ],
};

export class PackageDocNotFoundError extends Error {
  constructor(
    packageName: string,
    docPaths: readonly string[],
    public readonly attemptedPaths: string[]
  ) {
    super(
      `Required package docs for ${packageName} were not found. Tried: ${docPaths.join(
        ", "
      )}`
    );
    this.name = "PackageDocNotFoundError";
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function normalizeDocPath(docPath: string): string {
  const normalized = path.posix.normalize(docPath.replaceAll("\\", "/"));
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized)
  ) {
    return "README.md";
  }

  return normalized;
}

function getPackageDocCandidatePaths(
  root: string,
  packageName: string,
  normalizedDocPath: string
): string[] {
  const configuredRoots = PACKAGE_DOC_ROOTS_BY_PACKAGE[packageName];
  if (configuredRoots?.length) {
    return configuredRoots.map((configuredRoot) =>
      path.join(root, configuredRoot, normalizedDocPath)
    );
  }

  const packageRoot = path.join(root, "node_modules", packageName);
  return [path.join(packageRoot, normalizedDocPath)];
}

export async function readPackageDoc(
  packageName: string,
  docPath = "README.md"
): Promise<{ packageName: string; filePath: string; content: string }> {
  if (!PACKAGE_NAME_PATTERN.test(packageName)) {
    return {
      packageName,
      filePath: packageName,
      content: "",
    };
  }

  const root = process.cwd();
  const normalizedDocPath = normalizeDocPath(docPath);
  const candidatePaths = getPackageDocCandidatePaths(
    root,
    packageName,
    normalizedDocPath
  );

  let lastTriedPath = candidatePaths[0];

  for (const candidatePath of candidatePaths) {
    lastTriedPath = candidatePath;

    try {
      const content = await fs.readFile(candidatePath, "utf8");
      return {
        packageName,
        filePath: sanitizePath(candidatePath) ?? candidatePath,
        content,
      };
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  return {
    packageName,
    filePath: sanitizePath(lastTriedPath) ?? lastTriedPath,
    content: "",
  };
}

export async function readFirstAvailablePackageDoc(
  packageName: string,
  docPaths: string[]
): Promise<{ packageName: string; filePath: string; content: string }> {
  const attemptedPaths: string[] = [];

  for (const docPath of docPaths) {
    if (!docPath) {
      continue;
    }

    const doc = await readPackageDoc(packageName, docPath);
    attemptedPaths.push(doc.filePath);
    if (doc.content) {
      return doc;
    }
  }

  throw new PackageDocNotFoundError(packageName, docPaths, attemptedPaths);
}
