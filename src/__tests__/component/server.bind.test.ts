import {
  run,
  defineResource,
  resources as runnerResources,
} from "@bluelibs/runner";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { resources } from "../../index";
import type { ServerConfig } from "../../resources/server.resource";
import { LOOPBACK_HOST_REJECTION_MESSAGE } from "../../resources/routeHandlers/loopbackHostGuard";
import { createDummyApp } from "../dummy/dummyApp";
import { CODE_EXECUTION_DISABLED_ENV, withEnvAsync } from "../swap/withEnv";

const FOREIGN_HOST = "rebind.attacker.example:1337";
const SHELL_ENABLED_QUERY = { query: "{ shellEnabled }" };

async function startServer(config: ServerConfig) {
  const warnings: string[] = [];
  const logProbe = defineResource({
    id: "server-bind-log-probe",
    dependencies: { logger: runnerResources.logger },
    async init(_config, { logger }) {
      logger.onLog((log) => {
        if (log.level === "warn") warnings.push(String(log.message));
      });
    },
  });
  const runtime = await run(
    createDummyApp([
      logProbe,
      resources.introspector,
      resources.telemetry,
      resources.server.with(config),
      resources.graphql,
      resources.swapManager,
      resources.live,
    ]),
    { shutdownHooks: false, logs: { printThreshold: null } }
  );
  const server = runtime.getResourceValue(resources.server);
  // The server resource resolves before its socket is bound.
  if (!server.httpServer.listening) {
    await once(server.httpServer, "listening");
  }
  const exposureWarnings = () =>
    warnings.filter((message) =>
      message.includes("reachable from the network")
    );
  return { runtime, server, exposureWarnings };
}

describe("server bind address and Host check", () => {
  test("binds to 127.0.0.1 by default and rejects foreign Host headers", async () => {
    const { runtime, server, exposureWarnings } = await startServer({
      port: 0,
    });
    try {
      const address = server.httpServer.address() as AddressInfo;
      expect(address.address).toBe("127.0.0.1");

      const allowed = await request(server.httpServer)
        .post("/graphql")
        .send(SHELL_ENABLED_QUERY);
      expect(allowed.status).toBe(200);
      expect(allowed.body.data).toEqual({ shellEnabled: true });

      for (const path of [
        "/graphql",
        "/live/stream",
        "/docs/data",
        "/voyager",
      ]) {
        const rejected = await request(server.httpServer)
          .get(path)
          .set("Host", FOREIGN_HOST);
        expect(rejected.status).toBe(403);
        expect(rejected.body.errors[0].message).toBe(
          LOOPBACK_HOST_REJECTION_MESSAGE
        );
      }
      const rejectedPost = await request(server.httpServer)
        .post("/graphql")
        .set("Host", FOREIGN_HOST)
        .send(SHELL_ENABLED_QUERY);
      expect(rejectedPost.status).toBe(403);
      expect(exposureWarnings()).toEqual([]);
    } finally {
      await runtime.dispose();
    }
  });

  test("still serves clients that dial localhost", async () => {
    const { runtime, server } = await startServer({ port: 0 });
    try {
      const { port } = server.httpServer.address() as AddressInfo;
      const response = await fetch(`http://localhost:${port}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SHELL_ENABLED_QUERY),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: { shellEnabled: true },
      });
    } finally {
      await runtime.dispose();
    }
  });

  test("keeps the Host check for an explicit loopback host", async () => {
    const { runtime, server } = await startServer({
      port: 0,
      host: "127.0.0.1",
    });
    try {
      const rejected = await request(server.httpServer)
        .post("/graphql")
        .set("Host", FOREIGN_HOST)
        .send(SHELL_ENABLED_QUERY);
      expect(rejected.status).toBe(403);
    } finally {
      await runtime.dispose();
    }
  });

  test("an explicit network host skips the Host check and warns once when code execution is on", async () => {
    const { runtime, server, exposureWarnings } = await startServer({
      port: 0,
      host: "0.0.0.0",
    });
    try {
      const address = server.httpServer.address() as AddressInfo;
      expect(address.address).toBe("0.0.0.0");

      const response = await request(server.httpServer)
        .post("/graphql")
        .set("Host", FOREIGN_HOST)
        .send(SHELL_ENABLED_QUERY);
      expect(response.status).toBe(200);

      expect(exposureWarnings()).toHaveLength(1);
      expect(exposureWarnings()[0]).toContain("0.0.0.0");
    } finally {
      await runtime.dispose();
    }
  });

  test("an explicit network host does not warn when code execution is off", () =>
    withEnvAsync(CODE_EXECUTION_DISABLED_ENV, async () => {
      const { runtime, exposureWarnings } = await startServer({
        port: 0,
        host: "0.0.0.0",
      });
      try {
        expect(exposureWarnings()).toEqual([]);
      } finally {
        await runtime.dispose();
      }
    }));
});
