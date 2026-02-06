import { spawn } from "child_process";
import path from "node:path";
import fs from "fs/promises";
import os from "os";

async function writeFakeNpm(
  fakeBinDir: string,
  opts: { supportsRunTest: boolean; repoNodeModulesPath: string }
): Promise<void> {
  const npmJsPath = path.join(fakeBinDir, "npm.js");
  const js = `
const fs = require("fs/promises");
const path = require("node:path");

async function touch(filePath) {
  await fs.writeFile(filePath, "", { encoding: "utf8" });
}

async function ensureNodeModulesLinkOrDir(cwd, repoNodeModulesPath) {
  const nodeModulesPath = path.join(cwd, "node_modules");
  try {
    await fs.symlink(repoNodeModulesPath, nodeModulesPath, "dir");
  } catch {
    // On Windows or restricted environments, symlinks may not be allowed.
    await fs.mkdir(nodeModulesPath, { recursive: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const cwd = process.cwd();
  const repoNodeModulesPath = process.env.__FAKE_REPO_NODE_MODULES || "";

  if (cmd === "install") {
    process.stdout.write("Fake npm install: linking node_modules\\n");
    await touch(path.join(cwd, ".fake-npm-ran"));
    if (repoNodeModulesPath) {
      await ensureNodeModulesLinkOrDir(cwd, repoNodeModulesPath);
    }
    process.exit(0);
  }

  if (${opts.supportsRunTest ? "true" : "false"} && cmd === "run" && args[1] === "test") {
    process.stdout.write("Fake npm test: touching marker\\n");
    await touch(path.join(cwd, ".fake-tests-ran"));
    process.exit(0);
  }

  process.stdout.write("Fake npm: args " + args.join(" ") + "\\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(String((e && e.stack) || e) + "\\n");
  process.exit(1);
});
`.trimStart();
  await fs.writeFile(npmJsPath, js, { mode: 0o755 });

  const nodePath = process.execPath;
  const scriptEnvLine = `set "__FAKE_REPO_NODE_MODULES=${opts.repoNodeModulesPath}"`;

  // Unix-like: an executable "npm" file is enough.
  const npmShPath = path.join(fakeBinDir, "npm");
  const sh = `#!/bin/sh
export __FAKE_REPO_NODE_MODULES="${opts.repoNodeModulesPath}"
exec "${nodePath}" "${npmJsPath}" "$@"
`;
  await fs.writeFile(npmShPath, sh, { mode: 0o755 });

  // Windows: create npm.cmd because spawn("npm") typically resolves to npm.cmd.
  const npmCmdPath = path.join(fakeBinDir, "npm.cmd");
  const cmd = `@echo off
${scriptEnvLine}
"${nodePath}" "${npmJsPath}" %*
exit /b %errorlevel%
`;
  await fs.writeFile(npmCmdPath, cmd, { mode: 0o755 });
}

function runCli(
  args: string[],
  cwd: string,
  envOverride: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(
      process.execPath,
      [path.join(process.cwd(), "dist/cli.js"), ...args],
      {
        cwd,
        env: { ...process.env, ...envOverride },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += String(d)));
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += String(d)));
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

jest.setTimeout(180_000);

describe("CLI init", () => {
  let tempDir: string;
  let testProjectDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-test-"));
    testProjectDir = path.join(tempDir, "test-projects");
    await fs.mkdir(testProjectDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up the temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("creates new project in empty directory", async () => {
    const projectName = "test-project";
    const projectDir = path.join(testProjectDir, projectName);

    const res = await runCli(["new", projectName], testProjectDir);

    expect(res.code).toBe(0);

    // Verify key files were created
    const packageJson = await fs.readFile(
      path.join(projectDir, "package.json"),
      "utf-8"
    );
    const pkg = JSON.parse(packageJson);
    expect(pkg.name).toBe(projectName);

    // Verify src directory exists with main.ts using runner-dev scaffold
    const mainTs = await fs.readFile(
      path.join(projectDir, "src", "main.ts"),
      "utf-8"
    );
    expect(mainTs).toContain("@bluelibs/runner-dev");
    expect(mainTs).toContain("run(app)");

    // No manual install/test here; flags trigger those actions within the CLI
  });

  test("fails with existing non-empty directory", async () => {
    const projectName = "existing-project";
    const projectDir = path.join(testProjectDir, projectName);

    // Create the directory and add a file to make it non-empty
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "existing-file.txt"),
      "This file existed before scaffolding"
    );

    const res = await runCli(["new", projectName], testProjectDir);

    // Should exit with an error code and the message printed on stderr
    expect(res.code).toBe(1);
    const existing = await fs.readFile(
      path.join(projectDir, "existing-file.txt"),
      "utf-8"
    );
    expect(existing).toBe("This file existed before scaffolding");
  });

  test("scaffolds project and simulates --install (links node_modules)", async () => {
    const projectName = "installed-project";
    const projectDir = path.join(testProjectDir, projectName);

    // Create a fake npm script in a temporary bin directory to simulate install
    const fakeBinDir = path.join(tempDir, "fake-bin");
    await fs.mkdir(fakeBinDir, { recursive: true });

    await writeFakeNpm(fakeBinDir, {
      supportsRunTest: false,
      repoNodeModulesPath: path.join(process.cwd(), "node_modules"),
    });

    // Pre-create project dir parent to let CLI scaffold
    // Run CLI with PATH overridden so our fake npm is picked up
    const res = await runCli(
      ["new", "project", projectName, "--install"],
      testProjectDir,
      {
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ""}`,
        CI: "false",
        RUNNER_DEV_FAST: "0",
        RUNNER_DEV_SKIP_INSTALL: "0",
      }
    );
    expect(res.code).toBe(0);

    // Check that node_modules was linked
    // Check marker file created by fake npm to ensure it ran
    const marker = await fs.readFile(
      path.join(projectDir, ".fake-npm-ran"),
      "utf-8"
    );
    expect(marker.length).toBeGreaterThanOrEqual(0);

    // Verify package.json exists and name matches
    const packageJson = await fs.readFile(
      path.join(projectDir, "package.json"),
      "utf-8"
    );
    const pkg = JSON.parse(packageJson);
    expect(pkg.name).toBe(projectName);
  });

  test("scaffolds project and simulates --install and --run-tests", async () => {
    const projectName = "installed-and-tested-project";
    const projectDir = path.join(testProjectDir, projectName);

    const fakeBinDir = path.join(tempDir, "fake-bin-2");
    await fs.mkdir(fakeBinDir, { recursive: true });

    await writeFakeNpm(fakeBinDir, {
      supportsRunTest: true,
      repoNodeModulesPath: path.join(process.cwd(), "node_modules"),
    });

    const res = await runCli(
      ["new", "project", projectName, "--install", "--run-tests"],
      testProjectDir,
      {
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ""}`,
        CI: "false",
        RUNNER_DEV_FAST: "0",
        RUNNER_DEV_SKIP_INSTALL: "0",
        RUNNER_DEV_SKIP_TESTS: "0",
      }
    );
    expect(res.code).toBe(0);

    // Verify markers for install and tests
    const installed = await fs.readFile(
      path.join(projectDir, ".fake-npm-ran"),
      "utf-8"
    );
    expect(installed.length).toBeGreaterThanOrEqual(0);

    const tested = await fs.readFile(
      path.join(projectDir, ".fake-tests-ran"),
      "utf-8"
    );
    expect(tested.length).toBeGreaterThanOrEqual(0);

    // Basic file presence check
    const pkg = JSON.parse(
      await fs.readFile(path.join(projectDir, "package.json"), "utf-8")
    );
    expect(pkg.name).toBe(projectName);
  });
});
