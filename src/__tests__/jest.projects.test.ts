import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Guards the Jest `projects` routing: a test file that no project matches is
// silently never run, and one matched by two projects runs twice in
// different environments. TopologyCanvas.test.tsx once went unrun for exactly
// that first reason, so pin the invariant.

const repoRoot = process.cwd();
const jestConfigPath = path.join(repoRoot, "config", "jest", "jest.config.js");
const jestBinPath = path.join(
  repoRoot,
  "node_modules",
  "jest",
  "bin",
  "jest.js"
);
const TEST_FILE_PATTERN = /\.test\.tsx?$/;

function listProjectTestFiles(projectName: string): string[] {
  // Ask Jest itself so the check uses its real testMatch/ignore semantics.
  const output = execFileSync(
    process.execPath,
    [
      jestBinPath,
      "--config",
      jestConfigPath,
      `--selectProjects=${projectName}`,
      "--listTests",
      "--json",
    ],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const listed: unknown = JSON.parse(output);
  if (!Array.isArray(listed)) {
    throw new Error(`Jest --listTests returned non-array output: ${output}`);
  }
  return listed.map((filePath) => path.relative(repoRoot, String(filePath)));
}

function findTestFilesOnDisk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTestFilesOnDisk(entryPath);
    return TEST_FILE_PATTERN.test(entry.name)
      ? [path.relative(repoRoot, entryPath)]
      : [];
  });
}

describe("jest project routing", () => {
  it("runs every test file under src in exactly one project", () => {
    const claimedByProjects = [
      ...listProjectTestFiles("node"),
      ...listProjectTestFiles("jsdom"),
    ].sort();
    const testFilesOnDisk = findTestFilesOnDisk(
      path.join(repoRoot, "src")
    ).sort();

    expect(claimedByProjects).toEqual(testFilesOnDisk);
  }, 60_000);
});
