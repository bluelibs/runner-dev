import type { AddressInfo } from "node:net";
import { run, type RunOptions } from "@bluelibs/runner";
import request from "supertest";
import { dev } from "../../resources/dev.resource";
import { createDummyApp } from "../dummy/dummyApp";
import { withEnvAsync } from "../swap/withEnv";
import { startServer } from "./serverHarness";

const PASSWORD = "integration-only-private-password";
const AUTHORIZATION = `Basic ${Buffer.from(`runner:${PASSWORD}`).toString(
  "base64"
)}`;

const PRODUCTION_STARTS: {
  nodeEnv: string | undefined;
  mode?: RunOptions["mode"];
}[] = [
  { nodeEnv: "production" },
  { nodeEnv: "test", mode: "prod" },
  { nodeEnv: undefined, mode: "prod" },
  { nodeEnv: "production", mode: "dev" },
];

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
        expect(runtime.mode).toBe("prod");
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

  test.each(PRODUCTION_STARTS)(
    "fails without a password for NODE_ENV=$nodeEnv and mode=$mode",
    ({ nodeEnv, mode }) =>
      withEnvAsync(
        {
          RUNNER_DEV_HTTP_PASSWORD: undefined,
          NODE_ENV: nodeEnv,
          RUNNER_DEV_EVAL: "1",
        },
        async () => {
          await expect(startServer({ port: 0 }, mode)).rejects.toThrow(
            "RUNNER_DEV_HTTP_PASSWORD is required in production mode."
          );
        }
      )
  );

  test("dev.with also refuses production startup without a password", () =>
    withEnvAsync({ RUNNER_DEV_HTTP_PASSWORD: undefined }, async () => {
      await expect(
        run(createDummyApp([dev]), {
          mode: "prod",
          shutdownHooks: false,
          logs: { printThreshold: null },
        })
      ).rejects.toThrow(
        "RUNNER_DEV_HTTP_PASSWORD is required in production mode."
      );
    }));

  test("explicit production mode works with a password even under NODE_ENV=test", () =>
    withEnvAsync(
      { RUNNER_DEV_HTTP_PASSWORD: PASSWORD, NODE_ENV: "test" },
      async () => {
        const { runtime, server } = await startServer({ port: 0 }, "prod");
        try {
          expect(runtime.mode).toBe("prod");
          expect(
            (await request(server.httpServer).get("/voyager")).status
          ).toBe(401);
          const authenticated = await request(server.httpServer)
            .get("/voyager")
            .set("Authorization", AUTHORIZATION);
          expect(authenticated.status).toBe(200);
        } finally {
          await runtime.dispose();
        }
      }
    ));

  test("development can still start without a password", () =>
    withEnvAsync(
      { RUNNER_DEV_HTTP_PASSWORD: undefined, NODE_ENV: undefined },
      async () => {
        const { runtime, server } = await startServer({ port: 0 }, "dev");
        try {
          expect(
            (await request(server.httpServer).get("/voyager")).status
          ).toBe(200);
        } finally {
          await runtime.dispose();
        }
      }
    ));
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
