import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import request from "supertest";
import { createUiStaticRouter } from "../../resources/ui.static";

describe("ui static router", () => {
  test("serves index and injects tokens in js", async () => {
    const tmpDir = path.join(process.cwd(), "dist/ui-test");
    await fs.mkdir(path.join(tmpDir, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "index.html"),
      '<div id="root"></div>'
    );
    await fs.writeFile(
      path.join(tmpDir, "assets/app.js"),
      "console.log('__API_URL__','__OPENAI_API_BASE_URL__','__OPENAI_API_KEY__')"
    );

    process.env.API_URL = "http://x";
    process.env.OPENAI_API_BASE_URL = "http://y";
    process.env.OPENAI_API_KEY = "z";

    const app = express();
    app.use(createUiStaticRouter(tmpDir));

    const htmlRes = await request(app).get("/");
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.text).toContain('<div id="root"></div>');

    const jsRes = await request(app).get("/assets/app.js");
    expect(jsRes.status).toBe(200);
    expect(jsRes.text).toContain(JSON.stringify("http://x"));
    expect(jsRes.text).toContain(JSON.stringify("http://y"));
    expect(jsRes.text).toContain(JSON.stringify("z"));
  });
});
