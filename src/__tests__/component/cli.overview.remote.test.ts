import { run } from "@bluelibs/runner";
import { dev } from "../../resources/dev.resource";
import { createDummyApp } from "../dummy/dummyApp";
import { spawn } from "child_process";
import path from "node:path";
import { serverResource } from "../../resources/server.resource";

function runCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(
      process.execPath,
      [path.join(process.cwd(), "dist/cli.js"), ...args],
      {
        env: { ...process.env, ...env },
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

describe("CLI overview (remote)", () => {
  const port = 31339;
  const endpoint = `http://localhost:${port}/graphql`;
  let runner: any;

  beforeAll(async () => {
    const app = createDummyApp([dev.with({ port })]);
    runner = await run(app);
  });

  afterAll(async () => {
    if (runner && runner.getResourceValue) {
      try {
        const srv = await runner.getResourceValue(serverResource);
        await srv.apolloServer.stop();
        await new Promise<void>((resolve) =>
          srv.httpServer.close(() => resolve())
        );
      } catch {}
    }
  });

  test("prints markdown with counts", async () => {
    const res = await runCli(["overview", "--details", "5"], {
      ENDPOINT: endpoint,
    });
    expect(res.code).toBe(0);
    const out = res.stdout;
    expect(out).toContain("# Runner Dev Project Overview");
    expect(out).toMatch(/Tasks: \d+/);
    expect(out).toMatch(/Hooks: \d+/);
    expect(out).toMatch(/Resources: \d+/);
    expect(out).toMatch(/Events: \d+/);
  });
});
