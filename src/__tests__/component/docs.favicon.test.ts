import { Logger } from "@bluelibs/runner";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createDocsServeHandler } from "../../resources/routeHandlers/createDocsServeHandler";
import { createUiStaticRouter } from "../../resources/ui.static";

describe("docs favicon", () => {
  test("renders the docs HTML with the bunny favicon", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-docs-"));
    const manifestDir = path.join(tmpDir, ".vite");
    const manifestPath = path.join(manifestDir, "manifest.json");
    const logger = {
      warn: jest.fn(),
    } as unknown as Logger;

    await fs.mkdir(manifestDir, { recursive: true });
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        docs: {
          file: "assets/docs.js",
          css: ["assets/docs.css"],
          isEntry: true,
        },
      })
    );

    const handler = createDocsServeHandler(tmpDir, logger);
    const response = await new Promise<{
      html: string;
      headers: Record<string, string>;
    }>((resolve, reject) => {
      const res = {
        headers: {} as Record<string, string>,
        setHeader(key: string, value: string) {
          this.headers[key] = value;
        },
        send(html: string) {
          resolve({ html, headers: this.headers });
          return html;
        },
      } as any;

      Promise.resolve(handler({} as any, res)).catch(reject);
    });

    expect(response.headers["Content-Type"]).toBe("text/html");
    expect(response.html).toContain('rel="icon" href="/docs/favicon.ico"');
    expect(response.html).toContain('href="/assets/docs.css"');
    expect(response.html).toContain('"moduleScriptHref":"/assets/docs.js"');
    expect(response.html).toContain("This page expects the Runner-Dev server");
  });

  test("serves the docs favicon as a static asset", async () => {
    const app = express();
    app.use(createUiStaticRouter(path.join(process.cwd(), "src/ui/public")));

    const response = await request(app).get("/docs/favicon.ico");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("icon");
    expect(response.body.length).toBeGreaterThan(0);
  });
});
