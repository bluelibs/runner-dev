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

async function restoreSymlink({ destinationPath, symlinkTarget, type }) {
  await fs.rm(destinationPath, { force: true, recursive: true });
  await fs.symlink(symlinkTarget, destinationPath, type);

  console.log(
    `[npm-skills] Restored symlink ${path.relative(projectRoot, destinationPath)} -> ${symlinkTarget}.`,
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
