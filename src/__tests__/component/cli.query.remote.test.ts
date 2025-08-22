import { run, resource } from "@bluelibs/runner";
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

describe("CLI query (remote)", () => {
  const port = 31338;
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

  test("runs a simple query", async () => {
    const res = await runCli(["query", "query { tasks { id } }"], {
      ENDPOINT: endpoint,
    });
    expect(res.code).toBe(0);
    const parsed = JSON.parse(res.stdout || "null");
    expect(Array.isArray(parsed.tasks)).toBe(true);
  });

  test("namespace filter adds idIncludes", async () => {
    const res = await runCli(
      ["query", "query { tasks { id } }", "--namespace", "task."],
      { ENDPOINT: endpoint }
    );
    expect(res.code).toBe(0);
    const data = JSON.parse(res.stdout || "null");
    expect(Array.isArray(data.tasks)).toBe(true);
    // result should include tasks starting with task.
    expect(data.tasks.some((t: any) => String(t.id).startsWith("task."))).toBe(
      true
    );
  });
});
