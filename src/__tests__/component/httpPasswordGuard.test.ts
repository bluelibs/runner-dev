import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import request from "supertest";
import { createHttpPasswordGuard } from "../../resources/routeHandlers/httpPasswordGuard";

const PASSWORD = "test-only:парола 🔐";
const authorization = (password = PASSWORD, username = "runner") =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const servers: Server[] = [];

async function listen(app: express.Express) {
  // Use one listening socket per request group and close it after the test.
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  return server;
}

function createApp(password: string | undefined = PASSWORD) {
  const app = express();
  app.use(createHttpPasswordGuard(password));
  app.all("/task", (_req, res) => res.json({ success: true }));
  return listen(app);
}

describe("HTTP password guard", () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
  });

  test("requires a password when production protection is requested", () => {
    expect(() => createHttpPasswordGuard(undefined, true)).toThrow(
      "RUNNER_DEV_HTTP_PASSWORD is required in production mode."
    );
    expect(() => createHttpPasswordGuard("", true)).toThrow(
      "RUNNER_DEV_HTTP_PASSWORD must not be empty when set."
    );
    expect(() => createHttpPasswordGuard(PASSWORD, true)).not.toThrow();
  });

  test("leaves an unset password disabled and rejects empty settings", async () => {
    const app = express();
    app.use(createHttpPasswordGuard(undefined));
    app.get("/", (_req, res) => res.send("open"));
    expect((await request(await listen(app)).get("/")).text).toBe("open");
    for (const value of ["", "  ", "\n"]) {
      expect(() => createHttpPasswordGuard(value)).toThrow(
        "RUNNER_DEV_HTTP_PASSWORD must not be empty when set."
      );
    }
  });

  test("challenges missing or invalid credentials without reflecting secrets", async () => {
    const app = await createApp();
    const missing = await request(app).get("/task");
    expect(missing.status).toBe(401);
    expect(missing.headers["www-authenticate"]).toBe(
      'Basic realm="Runner DevTools", charset="UTF-8"'
    );
    expect(missing.headers["cache-control"]).toBe("no-store");
    for (const header of [
      authorization("wrong"),
      authorization(PASSWORD, "admin"),
      "Bearer secret",
      "Basic !!!!",
      "Basic A",
      `${authorization()}junk`,
    ]) {
      const result = await request(app)
        .post("/task")
        .set("Authorization", header);
      expect(result.status).toBe(401);
      expect(result.body).toEqual(missing.body);
    }
    expect(JSON.stringify(missing.body)).not.toContain(PASSWORD);
  });

  test("accepts UTF-8, colons, mixed-case scheme and unpadded credentials", async () => {
    const app = await createApp();
    for (const header of [
      authorization(),
      authorization().replace("Basic", "basic").replace(/=+$/, ""),
    ]) {
      const result = await request(app)
        .post("/task")
        .set("Authorization", header);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ success: true });
    }
    const spaced = await request(await createApp(" spaced "))
      .get("/task")
      .set("Authorization", authorization(" spaced "));
    expect(spaced.status).toBe(200);
  });

  test("rejects cross-site requests before challenging or running task routes", async () => {
    const app = await createApp();
    for (const headers of [
      { "Sec-Fetch-Site": "cross-site" },
      { "Sec-Fetch-Site": "same-site" },
      { Origin: "http://attacker.example" },
      { Origin: "http://localhost:8081" },
      { Origin: "null" },
      { Origin: "not-a-url" },
      { Origin: "ftp://localhost:8080" },
      { Origin: "http://localhost:8080/path" },
    ]) {
      for (const method of ["get", "post"] as const) {
        const result = await request(app)
          [method]("/task")
          .set("Host", "localhost:8080")
          .set("Authorization", authorization())
          .set(headers);
        expect(result.status).toBe(403);
        expect(result.headers["www-authenticate"]).toBeUndefined();
      }
    }
    const withoutCredentials = await request(app)
      .get("/task")
      .set("Sec-Fetch-Site", "cross-site");
    expect(withoutCredentials.status).toBe(403);
  });

  test("accepts same-origin requests and HTTPS termination at a proxy", async () => {
    const app = await createApp();
    for (const origin of ["http://localhost:8080", "https://localhost:8080"]) {
      const result = await request(app)
        .post("/task")
        .set("Host", "localhost:8080")
        .set("Origin", origin)
        .set("Sec-Fetch-Site", "same-origin")
        .set("Authorization", authorization());
      expect(result.status).toBe(200);
    }
  });

  test("limits failed guesses for one minute, then permits login again", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(100_000);
    try {
      const app = await createApp();
      for (let attempt = 1; attempt <= 20; attempt++) {
        const result = await request(app)
          .get("/task")
          .set("Authorization", authorization("wrong"));
        expect(result.status).toBe(attempt < 20 ? 401 : 429);
      }
      const blocked = await request(app)
        .get("/task")
        .set("Authorization", authorization());
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("60");
      now.mockReturnValue(160_000);
      const allowed = await request(app)
        .get("/task")
        .set("Authorization", authorization());
      expect(allowed.status).toBe(200);
    } finally {
      now.mockRestore();
    }
  });
});
