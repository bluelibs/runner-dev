import path from "node:path";
import os from "node:os";
import net, { type AddressInfo } from "node:net";
import { once } from "node:events";
import fs from "node:fs/promises";
import express from "express";
import {
  createUiStaticRouter,
  resolveUiAssetPath,
} from "../../resources/ui.static";

describe("ui static router", () => {
  test("injects runtime tokens in js assets", async () => {
    const tmpDir = path.join(process.cwd(), "dist/ui-test");
    await fs.mkdir(path.join(tmpDir, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "assets/app.js"),
      // [AI-CHAT-DISABLED] OpenAI tokens no longer injected
      "console.log('__API_URL__')"
    );

    // [AI-CHAT-DISABLED] process.env.OPENAI_API_BASE_URL = "http://y";
    // [AI-CHAT-DISABLED] process.env.OPENAI_API_KEY = "z";

    const router = createUiStaticRouter(tmpDir, {
      apiUrl: "http://x",
    }) as any;
    const jsLayer = router.stack.find(
      (layer: any) => layer?.route && String(layer.route.path).includes("\\.js")
    );
    expect(jsLayer).toBeTruthy();
    const jsHandler = jsLayer.route.stack[0].handle;

    const body = await new Promise<string>((resolve, reject) => {
      const req: any = { path: "/assets/app.js" };
      const res: any = {
        headers: {} as Record<string, string>,
        setHeader(key: string, value: string) {
          this.headers[key] = value;
        },
        send(payload: string) {
          resolve(payload);
          return payload;
        },
      };
      jsHandler(req, res, (err?: unknown) => {
        if (err) reject(err);
      }).catch(reject);
    });

    expect(body).toContain(JSON.stringify("http://x"));
    // [AI-CHAT-DISABLED] OpenAI token assertions removed
    // expect(body).toContain(JSON.stringify("http://y"));
    // expect(body).toContain(JSON.stringify("z"));
  });
});

describe("ui static router path containment", () => {
  const uiRoot = path.join(os.tmpdir(), "runner-dev-ui-static-root");
  const uiDir = path.join(uiRoot, "ui");
  const outsideFile = path.join(uiRoot, "secret.js");

  beforeAll(async () => {
    await fs.mkdir(path.join(uiDir, "assets"), { recursive: true });
    await fs.writeFile(path.join(uiDir, "assets/app.js"), "'inside'");
    await fs.writeFile(outsideFile, "'OUTSIDE_UI_DIR'");
  });

  afterAll(async () => {
    await fs.rm(uiRoot, { recursive: true, force: true });
  });

  test("resolveUiAssetPath keeps paths inside the UI directory", () => {
    expect(resolveUiAssetPath(uiDir, "/assets/app.js")).toBe(
      path.join(uiDir, "assets/app.js")
    );
    expect(resolveUiAssetPath(uiDir, "/a/../assets/app.js")).toBe(
      path.join(uiDir, "assets/app.js")
    );
    expect(resolveUiAssetPath(uiDir, "/../secret.js")).toBeNull();
    expect(resolveUiAssetPath(uiDir, "/assets/../../secret.js")).toBeNull();
  });

  // Raw socket on purpose: HTTP clients normalize `..` before sending, while
  // a hand-written request line reaches Express verbatim.
  async function rawGet(port: number, requestPath: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.write(
          `GET ${requestPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`
        );
      });
      let response = "";
      socket.on("data", (chunk) => (response += chunk.toString()));
      socket.on("end", () => resolve(response));
      socket.on("error", reject);
    });
  }

  test("does not serve .js files outside the UI directory", async () => {
    const app = express();
    app.use(createUiStaticRouter(uiDir));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const { port } = server.address() as AddressInfo;

      const inside = await rawGet(port, "/assets/app.js");
      expect(inside).toContain("200 OK");
      expect(inside).toContain("'inside'");

      for (const escape of ["/../secret.js", "/assets/../../secret.js"]) {
        const response = await rawGet(port, escape);
        expect(response).not.toContain("OUTSIDE_UI_DIR");
        expect(response).not.toContain("200 OK");
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
