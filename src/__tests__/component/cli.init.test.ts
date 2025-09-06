import { spawn, spawnSync } from "child_process";
import path from "node:path";
import fs from "fs/promises";
import os from "os";

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
    // Use a more flexible check that handles path resolution differences
    expect(res.stdout).toContain("Project created in");
    expect(res.stdout).toContain(projectName);

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

    // Log the output for debugging
    console.log("Exit code:", res.code);
    console.log("Stdout:", res.stdout);
    console.log("Stderr:", res.stderr);

    // Should exit with an error code and the message printed on stderr
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("already exists and is not empty");
  });

  test("scaffolds project and simulates --install (links node_modules)", async () => {
    const projectName = "installed-project";
    const projectDir = path.join(testProjectDir, projectName);

    // Create a fake npm script in a temporary bin directory to simulate install
    const fakeBinDir = path.join(tempDir, "fake-bin");
    await fs.mkdir(fakeBinDir, { recursive: true });

    // The fake npm will create a symlink from projectDir/node_modules to repo's node_modules
    const fakeNpmPath = path.join(fakeBinDir, "npm");
    const script = `#!/bin/sh
echo "Fake npm install: linking node_modules"
touch "$PWD/.fake-npm-ran"
ln -s "${path.join(process.cwd(), "node_modules")}" "$PWD/node_modules" || true
`;
    await fs.writeFile(fakeNpmPath, script, { mode: 0o755 });

    // Pre-create project dir parent to let CLI scaffold
    // Run CLI with PATH overridden so our fake npm is picked up
    const res = await runCli(
      ["new", "project", projectName, "--install"],
      testProjectDir,
      {
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        CI: "false",
        RUNNER_DEV_FAST: "0",
        RUNNER_DEV_SKIP_INSTALL: "0",
      }
    );

    // Debug output to help diagnose CI/test environment issues
    // eslint-disable-next-line no-console
    console.log("CLI stdout:\n", res.stdout);
    // eslint-disable-next-line no-console
    console.log("CLI stderr:\n", res.stderr);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Project created in");

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

    const fakeNpmPath = path.join(fakeBinDir, "npm");
    const script = `#!/bin/sh
case "$1" in
  install)
    echo "Fake npm install: linking node_modules"
    touch "$PWD/.fake-npm-ran"
    ln -s "${path.join(
      process.cwd(),
      "node_modules"
    )}" "$PWD/node_modules" 2>/dev/null || true
    ;;
  run)
    if [ "$2" = "test" ]; then
      echo "Fake npm test: touching marker"
      touch "$PWD/.fake-tests-ran"
    fi
    ;;
  *)
    echo "Fake npm: args $@"
    ;;
esac
exit 0
`;
    await fs.writeFile(fakeNpmPath, script, { mode: 0o755 });

    const res = await runCli(
      ["new", "project", projectName, "--install", "--run-tests"],
      testProjectDir,
      {
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        CI: "false",
        RUNNER_DEV_FAST: "0",
        RUNNER_DEV_SKIP_INSTALL: "0",
        RUNNER_DEV_SKIP_TESTS: "0",
      }
    );

    // eslint-disable-next-line no-console
    console.log("CLI stdout (install+tests):\n", res.stdout);
    // eslint-disable-next-line no-console
    console.log("CLI stderr (install+tests):\n", res.stderr);

    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Project created in");

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
