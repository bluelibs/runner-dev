import fs from "node:fs/promises";
import path from "node:path";
import { sanitizePath } from "../utils/path";

export const RUNNER_FRAMEWORK_COMPACT_DOC_PATHS = [
  "readmes/COMPACT_GUIDE.md",
] as const;

export const RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS = [
  "readmes/FULL_GUIDE.md",
] as const;

export async function readPackageDoc(
  packageName: string,
  docPath = "README.md"
): Promise<{ packageName: string; filePath: string; content: string }> {
  const root = process.cwd();
  const filePath = path.join(root, "node_modules", packageName, docPath);
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return { packageName, filePath: sanitizePath(filePath) ?? filePath, content };
}

export async function readFirstAvailablePackageDoc(
  packageName: string,
  docPaths: string[]
): Promise<{ packageName: string; filePath: string; content: string }> {
  for (const docPath of docPaths) {
    if (!docPath) {
      continue;
    }

    const doc = await readPackageDoc(packageName, docPath);
    if (doc.content) {
      return doc;
    }
  }

  const fallbackPath = docPaths[0] ?? "README.md";
  return readPackageDoc(packageName, fallbackPath);
}
