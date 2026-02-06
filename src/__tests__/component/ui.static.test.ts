import path from "node:path";
import fs from "node:fs/promises";
import { createUiStaticRouter } from "../../resources/ui.static";

describe("ui static router", () => {
  test("injects runtime tokens in js assets", async () => {
    const tmpDir = path.join(process.cwd(), "dist/ui-test");
    await fs.mkdir(path.join(tmpDir, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "assets/app.js"),
      "console.log('__API_URL__','__OPENAI_API_BASE_URL__','__OPENAI_API_KEY__')"
    );

    process.env.API_URL = "http://x";
    process.env.OPENAI_API_BASE_URL = "http://y";
    process.env.OPENAI_API_KEY = "z";

    const router = createUiStaticRouter(tmpDir) as any;
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
    expect(body).toContain(JSON.stringify("http://y"));
    expect(body).toContain(JSON.stringify("z"));
  });
});
