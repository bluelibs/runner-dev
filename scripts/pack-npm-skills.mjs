#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const mode = process.argv[2];

// npm drops symlinks from the tarball, so every link inside the published
// skill is replaced by a copy for packing and restored afterwards.
const syncPairs = [
  {
    sourcePath: path.join(projectRoot, "README.md"),
    destinationPath: path.join(
      projectRoot,
      "skills",
      "core",
      "references",
      "README.md",
    ),
    symlinkTarget: "../../../README.md",
    type: "file",
  },
  {
    sourcePath: path.join(projectRoot, "readmes"),
    destinationPath: path.join(
      projectRoot,
      "skills",
      "core",
      "references",
      "readmes",
    ),
    symlinkTarget: "../../../readmes",
    type: "dir",
  },
];

if (mode !== "materialize" && mode !== "restore") {
  console.error(
    "[npm-skills] Expected mode to be either 'materialize' or 'restore'.",
  );
  process.exit(1);
}

async function materialize({ sourcePath, destinationPath }) {
  await fs.rm(destinationPath, { force: true, recursive: true });
  await fs.cp(sourcePath, destinationPath, { recursive: true });

  console.log(
    `[npm-skills] Materialized ${path.relative(projectRoot, destinationPath)}.`,
  );
}

/** Whether two files, or two directory trees, hold the same bytes. */
async function hasSameContent(pathA, pathB) {
  const [statA, statB] = await Promise.all([fs.stat(pathA), fs.stat(pathB)]);
  if (statA.isDirectory() !== statB.isDirectory()) return false;
  if (!statA.isDirectory()) {
    const [bytesA, bytesB] = await Promise.all([
      fs.readFile(pathA),
      fs.readFile(pathB),
    ]);
    return bytesA.equals(bytesB);
  }
  const [entriesA, entriesB] = await Promise.all([
    fs.readdir(pathA),
    fs.readdir(pathB),
  ]);
  if (entriesA.sort().join("\0") !== entriesB.sort().join("\0")) return false;
  for (const entry of entriesA) {
    const same = await hasSameContent(
      path.join(pathA, entry),
      path.join(pathB, entry),
    );
    if (!same) return false;
  }
  return true;
}

/** lstat that reports a missing path as null instead of throwing. */
async function lstatOrNull(filePath) {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Puts the link back. It runs after every pack and before every build, so
 * a pack that failed or was interrupted between materialize and restore
 * heals on the next build instead of leaving copies to be committed.
 *
 * A link that is already right is left alone. A copy is removed only while
 * it still equals its source: anything else means it was edited in place
 * (or the source changed since), and deleting it could lose work.
 */
async function restoreSymlink({
  sourcePath,
  destinationPath,
  symlinkTarget,
  type,
}) {
  const relativeDestination = path.relative(projectRoot, destinationPath);
  const current = await lstatOrNull(destinationPath);
  if (current?.isSymbolicLink()) {
    if ((await fs.readlink(destinationPath)) === symlinkTarget) return;
  } else if (current && !(await hasSameContent(destinationPath, sourcePath))) {
    const relativeSource = path.relative(projectRoot, sourcePath);
    throw new Error(
      `${relativeDestination} is a copy that differs from ${relativeSource}, ` +
        `so it was not replaced by its symlink. Either it was edited after a ` +
        `pack copied it in, or ${relativeSource} changed since. Move any ` +
        `edits worth keeping into ${relativeSource}, delete ` +
        `${relativeDestination}, then run: npm run skills:pack:restore`,
    );
  }

  await fs.rm(destinationPath, { force: true, recursive: true });
  await fs.symlink(symlinkTarget, destinationPath, type);

  console.log(
    `[npm-skills] Restored symlink ${relativeDestination} -> ${symlinkTarget}.`,
  );
}

try {
  for (const syncPair of syncPairs) {
    if (mode === "materialize") {
      await materialize(syncPair);
    } else {
      await restoreSymlink(syncPair);
    }
  }
} catch (error) {
  console.error(
    `[npm-skills] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
