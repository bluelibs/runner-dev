import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { withEnvAsync } from "../swap/withEnv";
import { startServer } from "./serverHarness";

const API_URL_TOKEN = "__API_URL__";

/**
 * Starts the server with its UI directory pointed at a fake build whose one
 * script contains the API URL token, and returns that script as served to a
 * browser that reached the server through a LAN address.
 */
async function fetchServedUiScript(host?: string): Promise<string> {
  const projectDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "runner-dev-ui-api-url-")
  );
  const assetsDir = path.join(projectDir, "dist", "ui", "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(
    path.join(assetsDir, "docs.js"),
    `const API = ${API_URL_TOKEN};`
  );

  // The server looks for the UI build under the working directory first.
  const cwd = jest.spyOn(process, "cwd").mockReturnValue(projectDir);
  let started: Awaited<ReturnType<typeof startServer>>;
  try {
    started = await startServer({ port: 0, host });
  } finally {
    cwd.mockRestore();
  }

  try {
    const response = await request(started.server.httpServer)
      .get("/assets/docs.js")
      .set("Host", "192.168.1.50:1337");
    expect(response.status).toBe(200);
    return response.text;
  } finally {
    await started.runtime.dispose();
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}

describe("docs UI API base", () => {
  test.each([undefined, "0.0.0.0"])(
    "with host %p the served UI calls the origin it was loaded from",
    (host) =>
      withEnvAsync({ API_URL: undefined }, async () => {
        const script = await fetchServedUiScript(host);
        // An empty base makes the UI fall back to window.location.origin; a
        // baked http://localhost:<port> would send a LAN browser to itself.
        expect(script).toBe('const API = "";');
        expect(process.env.API_URL).toBeUndefined();
      })
  );

  test("API_URL overrides the API base", () =>
    withEnvAsync({ API_URL: "https://runner.example" }, async () => {
      const script = await fetchServedUiScript("0.0.0.0");
      expect(script).toBe('const API = "https://runner.example";');
    }));
});
