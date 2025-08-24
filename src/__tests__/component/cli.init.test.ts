import { spawn } from "child_process";
import path from "node:path";
import fs from "fs/promises";
import os from "os";

function runCli(
  args: string[],
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(
      process.execPath,
      [path.join(process.cwd(), "dist/cli.js"), ...args],
      {
        cwd,
        env: process.env,
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
    
    // Verify src directory exists with main.ts
    const mainTs = await fs.readFile(
      path.join(projectDir, "src", "main.ts"),
      "utf-8"
    );
    expect(mainTs).toContain("Hello from test-project!");
  });

  test("works with existing non-empty directory", async () => {
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
    
    // For now, just check that it runs without crashing
    expect(res.code).toBe(0);
    
    // Check that it shows the warning
    expect(res.stdout).toContain("already exists and is not empty");
    
    // Check that it still creates the project
    expect(res.stdout).toContain("Project created in");
  });
});