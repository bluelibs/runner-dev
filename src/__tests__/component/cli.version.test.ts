import { spawn } from "child_process";
import fs from "fs";
import path from "node:path";

function runCli(
  args: string[]
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
    const useBuiltCli = fs.existsSync(builtCliPath);
    const proc = spawn(
      process.execPath,
      useBuiltCli
        ? [builtCliPath, ...args]
        : ["-r", tsNodeRegisterPath, sourceCliPath, ...args],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.join(process.cwd(), "config/ts/tsconfig.json"),
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

describe("CLI version flag", () => {
  test.each([["--version"], ["-v"], ["version"]])(
    "%s prints package version and exits 0",
    async (flag) => {
      const res = await runCli([flag]);
      expect(res.code).toBe(0);
      // basic semver-ish check or 'unknown' in worst case
      expect(res.stdout.trim()).toMatch(/^(unknown|\d+\.\d+\.\d+(?:[-+].*)?)$/);
      expect(res.stderr).toBe("");
    }
  );
});
