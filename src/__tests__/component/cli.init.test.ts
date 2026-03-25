import { spawn } from "child_process";
import path from "node:path";
import fs from "fs/promises";
import syncFs from "fs";
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

  if (${
    opts.supportsRunTest ? "true" : "false"
  } && cmd === "run" && args[1] === "test") {
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

async function ensureSymlinkDir(
  targetPath: string,
  linkPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  try {
    await fs.symlink(targetPath, linkPath, "junction");
  } catch (error: any) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
  }
}

async function writeVitestShim(projectDir: string): Promise<void> {
  const vitestDir = path.join(projectDir, "node_modules", "vitest");
  const vitestBinDir = path.join(projectDir, "node_modules", ".bin");

  await fs.mkdir(vitestDir, { recursive: true });
  await fs.mkdir(vitestBinDir, { recursive: true });

  await fs.writeFile(
    path.join(vitestDir, "package.json"),
    JSON.stringify(
      {
        name: "vitest",
        version: "0.0.0-test-shim",
        private: true,
        main: "index.cjs",
        bin: {
          vitest: "bin/vitest.cjs",
        },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  await fs.writeFile(
    path.join(vitestDir, "index.cjs"),
    `
const state = {
  tests: [],
  afterEachFns: [],
};

function describe(_name, fn) {
  fn();
}

function it(name, fn) {
  state.tests.push({ name, fn });
}

function afterEach(fn) {
  state.afterEachFns.push(fn);
}

function expect(received) {
  return {
    toBe(expected) {
      if (!Object.is(received, expected)) {
        throw new Error(\`Expected \${JSON.stringify(received)} to be \${JSON.stringify(expected)}\`);
      }
    },
    toBeDefined() {
      if (received === undefined) {
        throw new Error("Expected value to be defined");
      }
    },
  };
}

async function runRegisteredTests() {
  let passed = 0;

  for (const test of state.tests) {
    try {
      await test.fn();
      passed += 1;
    } finally {
      for (const hook of state.afterEachFns) {
        await hook();
      }
    }
  }

  return passed;
}

function reset() {
  state.tests = [];
  state.afterEachFns = [];
}

module.exports = {
  afterEach,
  describe,
  expect,
  it,
  __runRegisteredTests: runRegisteredTests,
  __reset: reset,
};
`.trimStart(),
    { encoding: "utf8" }
  );

  await fs.mkdir(path.join(vitestDir, "bin"), { recursive: true });
  await fs.writeFile(
    path.join(vitestDir, "bin", "vitest.cjs"),
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { register } = require("tsx/cjs/api");
const vitest = require("../index.cjs");

register();

function collectTests(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTests(fullPath));
      continue;
    }
    if (entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const srcDir = path.join(process.cwd(), "src");
  const testFiles = collectTests(srcDir);
  let passed = 0;

  for (const filePath of testFiles) {
    vitest.__reset();
    require(filePath);
    passed += await vitest.__runRegisteredTests();
  }

  console.log(\`Test Files  \${testFiles.length} passed\`);
  console.log(\`Tests       \${passed} passed\`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`,
    { encoding: "utf8", mode: 0o755 }
  );

  await fs.writeFile(
    path.join(vitestBinDir, "vitest"),
    `#!/bin/sh
exec node "$PWD/node_modules/vitest/bin/vitest.cjs" "$@"
`,
    { encoding: "utf8", mode: 0o755 }
  );
}

async function linkGeneratedProjectDependencies(
  projectDir: string
): Promise<void> {
  const repoRoot = process.cwd();
  const repoNodeModules = path.join(repoRoot, "node_modules");
  const projectNodeModules = path.join(projectDir, "node_modules");

  await fs.mkdir(projectNodeModules, { recursive: true });
  await ensureSymlinkDir(
    path.join(repoNodeModules, "@types"),
    path.join(projectNodeModules, "@types")
  );
  await ensureSymlinkDir(
    path.join(repoNodeModules, "typescript"),
    path.join(projectNodeModules, "typescript")
  );
  await ensureSymlinkDir(
    path.join(repoNodeModules, "tsx"),
    path.join(projectNodeModules, "tsx")
  );
  await ensureSymlinkDir(
    path.join(repoNodeModules, "npm-skills"),
    path.join(projectNodeModules, "npm-skills")
  );
  await ensureSymlinkDir(
    path.join(repoNodeModules, "@bluelibs", "runner"),
    path.join(projectNodeModules, "@bluelibs", "runner")
  );
  await ensureSymlinkDir(
    path.join(repoNodeModules, "@bluelibs", "smart"),
    path.join(projectNodeModules, "@bluelibs", "smart")
  );
  await ensureSymlinkDir(
    repoRoot,
    path.join(projectNodeModules, "@bluelibs", "runner-dev")
  );
  await writeVitestShim(projectDir);
}

function runCli(
  args: string[],
  cwd: string,
  envOverride: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const builtCliPath = path.join(process.cwd(), "dist/cli.js");
    const sourceCliPath = path.join(process.cwd(), "src/cli.ts");
    const tsNodeRegisterPath = path.join(
      process.cwd(),
      "node_modules",
      "ts-node",
      "register",
      "transpile-only"
    );
    const useBuiltCli =
      process.env.RUNNER_DEV_TEST_USE_BUILT === "1" &&
      syncFs.existsSync(builtCliPath);
    const proc = spawn(
      process.execPath,
      useBuiltCli
        ? [builtCliPath, ...args]
        : ["-r", tsNodeRegisterPath, sourceCliPath, ...args],
      {
        cwd,
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.join(process.cwd(), "config/ts/tsconfig.json"),
          ...envOverride,
        },
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

function _runCmd(
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
    expect(pkg.dependencies?.["@bluelibs/runner"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@bluelibs/runner-dev"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@types/node"]).toBe("^20.0.0");
    expect(pkg.dependencies?.["npm-skills"]).toBe("^0.5.0");
    expect(pkg.scripts?.qa).toBe("npm run build && npm run test");
    expect(pkg.scripts?.["skills:extract"]).toBe(
      "npm-skills extract --skip-production --override"
    );
    expect(pkg.scripts?.postinstall).toBe("npm run skills:extract");
    expect(pkg.scripts?.prepare).toBeUndefined();
    expect(pkg.npmSkills).toBeUndefined();

    const tsconfigJson = await fs.readFile(
      path.join(projectDir, "tsconfig.json"),
      "utf-8"
    );
    const tsconfig = JSON.parse(tsconfigJson);
    expect(tsconfig.compilerOptions?.module).toBe("CommonJS");
    expect(tsconfig.compilerOptions?.moduleResolution).toBe("node");

    const appTs = await fs.readFile(
      path.join(projectDir, "src", "app.ts"),
      "utf-8"
    );
    expect(appTs).toContain("import { r } from '@bluelibs/runner';");
    expect(appTs).toContain("import { dev } from '@bluelibs/runner-dev';");
    expect(appTs).toContain("export const app = r.resource(");

    const mainTs = await fs.readFile(
      path.join(projectDir, "src", "main.ts"),
      "utf-8"
    );
    expect(mainTs).toContain("import { run } from '@bluelibs/runner';");
    expect(mainTs).toContain("import { app } from './app';");
    expect(mainTs).toContain("run(app)");

    const appTestTs = await fs.readFile(
      path.join(projectDir, "src", "app.test.ts"),
      "utf-8"
    );
    expect(appTestTs).toContain("import { app } from './app';");
    expect(appTestTs).toContain("boots the runtime");

    const gitignore = await fs.readFile(
      path.join(projectDir, ".gitignore"),
      "utf-8"
    );
    expect(gitignore).toBe("node_modules\n.env\ndist\n.agents/skills\n\n");

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
    expect(pkg.dependencies?.["@bluelibs/runner"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@bluelibs/runner-dev"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@types/node"]).toBe("^20.0.0");
    expect(pkg.dependencies?.["npm-skills"]).toBe("^0.5.0");
    expect(pkg.scripts?.qa).toBe("npm run build && npm run test");
    expect(pkg.scripts?.["skills:extract"]).toBe(
      "npm-skills extract --skip-production --override"
    );
    expect(pkg.scripts?.postinstall).toBe("npm run skills:extract");
    expect(pkg.scripts?.prepare).toBeUndefined();
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
    expect(pkg.dependencies?.["@bluelibs/runner"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@bluelibs/runner-dev"]).toBe("^6.4.0");
    expect(pkg.devDependencies?.["@types/node"]).toBe("^20.0.0");
    expect(pkg.dependencies?.["npm-skills"]).toBe("^0.5.0");
    expect(pkg.scripts?.qa).toBe("npm run build && npm run test");
    expect(pkg.scripts?.["skills:extract"]).toBe(
      "npm-skills extract --skip-production --override"
    );
    expect(pkg.scripts?.postinstall).toBe("npm run skills:extract");
    expect(pkg.scripts?.prepare).toBeUndefined();
  });

  test("scaffolds project that passes the generated qa script", async () => {
    const projectName = "qa-project";
    const projectDir = path.join(testProjectDir, projectName);

    const res = await runCli(["new", "project", projectName], testProjectDir);
    expect(res.code).toBe(0);

    await linkGeneratedProjectDependencies(projectDir);

    const qa = await _runCmd("npm", ["run", "qa"], projectDir, {
      CI: "true",
    });

    expect(qa.code).toBe(0);
    expect(qa.stdout).toContain("npm run build");
    expect(qa.stdout).toContain("npm run test");
    expect(qa.stdout).toContain("Tests       1 passed");
  });
});
