import type { AddressInfo } from "node:net";
import request from "supertest";
import { withEnvAsync } from "../swap/withEnv";
import { startServer } from "./serverHarness";

const PASSWORD = "integration-only-private-password";
const AUTHORIZATION = `Basic ${Buffer.from(`runner:${PASSWORD}`).toString(
  "base64"
)}`;

describe("server password protection", () => {
  test("protects every route in production, including routes registered later", () =>
    withEnvAsync(
      {
        RUNNER_DEV_HTTP_PASSWORD: PASSWORD,
        NODE_ENV: "production",
        RUNNER_DEV_EVAL: undefined,
      },
      async () => {
        const { runtime, server } = await startServer({ port: 0 });
        let taskCalls = 0;
        server.app.get("/password-task", (_req, res) => {
          taskCalls++;
          res.json({ success: true });
        });
        try {
          for (const path of [
            "/",
            "/docs",
            "/docs/data",
            "/graphql",
            "/live/stream",
            "/voyager",
            "/assets/example.js",
            "/password-task",
          ]) {
            const rejected = await request(server.httpServer).get(path);
            expect(rejected.status).toBe(401);
          }
          const missing = await request(server.httpServer)
            .post("/graphql")
            .send({ query: "{ codeExecutionEnabled }" });
          expect(missing.status).toBe(401);
          expect(taskCalls).toBe(0);

          const allowed = await request(server.httpServer)
            .post("/graphql")
            .set("Authorization", AUTHORIZATION)
            .send({
              query: "{ codeExecutionEnabled resources { id config } }",
            });
          expect(allowed.status).toBe(200);
          expect(allowed.body.errors).toBeUndefined();
          expect(allowed.body.data.codeExecutionEnabled).toBe(false);
          expect(JSON.stringify(allowed.body)).not.toContain(PASSWORD);

          const docs = await request(server.httpServer)
            .get("/docs/")
            .set("Authorization", AUTHORIZATION);
          expect(docs.status).toBe(200);
          expect(docs.text).not.toContain(PASSWORD);
          const assetPath = docs.text.match(
            /"moduleScriptHref":"([^"]+)"/
          )?.[1];
          if (!assetPath) throw new Error("Expected the docs UI script");
          const assetUrl = new URL(assetPath, "http://localhost/docs/")
            .pathname;
          const unauthenticatedAsset = await request(server.httpServer).get(
            assetUrl
          );
          expect(unauthenticatedAsset.status).toBe(401);
          const asset = await request(server.httpServer)
            .get(assetUrl)
            .set("Authorization", AUTHORIZATION);
          expect(asset.status).toBe(200);
          expect(asset.headers["cache-control"]).toBe("no-store");
          expect(asset.text).not.toContain(PASSWORD);
          const data = await request(server.httpServer)
            .get("/docs/data")
            .set("Authorization", AUTHORIZATION);
          expect(data.status).toBe(200);
          expect(data.text).not.toContain(PASSWORD);

          const task = await request(server.httpServer)
            .get("/password-task")
            .set("Authorization", AUTHORIZATION);
          expect(task.status).toBe(200);
          expect(taskCalls).toBe(1);
          const crossSite = await request(server.httpServer)
            .get("/password-task")
            .set("Authorization", AUTHORIZATION)
            .set("Sec-Fetch-Site", "cross-site");
          expect(crossSite.status).toBe(403);
          expect(taskCalls).toBe(1);

          const rebound = await request(server.httpServer)
            .get("/docs")
            .set("Host", "attacker.example")
            .set("Authorization", AUTHORIZATION);
          expect(rebound.status).toBe(403);

          const address = server.httpServer.address();
          if (!address || typeof address === "string") {
            throw new Error("Expected a TCP server address");
          }
          await expectLiveStream(address, AUTHORIZATION);
        } finally {
          await runtime.dispose();
        }
      }
    ));

  test("fails startup for an empty environment password", () =>
    withEnvAsync({ RUNNER_DEV_HTTP_PASSWORD: "" }, async () => {
      await expect(startServer({ port: 0 })).rejects.toThrow(
        "RUNNER_DEV_HTTP_PASSWORD must not be empty when set."
      );
    }));
});

async function expectLiveStream(address: AddressInfo, authorization: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/live/stream`,
      { headers: { Authorization: authorization }, signal: controller.signal }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    if (!response.body) throw new Error("Expected a live stream body");
    const chunk = await response.body.getReader().read();
    expect(chunk.done).toBe(false);
    expect(new TextDecoder().decode(chunk.value)).toContain("event:");
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
