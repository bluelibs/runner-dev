import type { AddressInfo } from "node:net";
import request from "supertest";
import { hostRejectionMessage } from "../../resources/routeHandlers/hostGuard";
import { CODE_EXECUTION_DISABLED_ENV, withEnvAsync } from "../swap/withEnv";
import { startServer } from "./serverHarness";

const FOREIGN_HOSTNAME = "rebind.attacker.example";
const FOREIGN_HOST = `${FOREIGN_HOSTNAME}:1337`;
const SHELL_ENABLED_QUERY = { query: "{ shellEnabled }" };

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
          hostRejectionMessage(FOREIGN_HOSTNAME)
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

  // "127.1" binds 127.0.0.1 but is not one of the usual spellings: the guard
  // must not depend on how loopback was written, and no network-exposure
  // warning may claim otherwise.
  test("guards a loopback host spelled unusually and does not warn", async () => {
    const { runtime, server, exposureWarnings } = await startServer({
      port: 0,
      host: "127.1",
    });
    try {
      const address = server.httpServer.address() as AddressInfo;
      expect(address.address).toBe("127.0.0.1");

      const rejected = await request(server.httpServer)
        .post("/graphql")
        .set("Host", FOREIGN_HOST)
        .send(SHELL_ENABLED_QUERY);
      expect(rejected.status).toBe(403);
      expect(exposureWarnings()).toEqual([]);
    } finally {
      await runtime.dispose();
    }
  });

  test("a network host keeps the Host check, allows addresses and allowedHosts, and warns once when code execution is on", async () => {
    const { runtime, server, exposureWarnings } = await startServer({
      port: 0,
      host: "0.0.0.0",
      allowedHosts: ["devbox.lan"],
    });
    try {
      const address = server.httpServer.address() as AddressInfo;
      expect(address.address).toBe("0.0.0.0");

      // A published Docker port is reachable on the developer's 127.0.0.1,
      // so a rebound page must still be refused on a network bind.
      const rebound = await request(server.httpServer)
        .post("/graphql")
        .set("Host", FOREIGN_HOST)
        .send(SHELL_ENABLED_QUERY);
      expect(rebound.status).toBe(403);

      for (const hostHeader of [
        "192.168.1.50:1337",
        "localhost:8080",
        "devbox.lan:1337",
      ]) {
        const allowed = await request(server.httpServer)
          .post("/graphql")
          .set("Host", hostHeader)
          .send(SHELL_ENABLED_QUERY);
        expect(allowed.status).toBe(200);
      }

      expect(exposureWarnings()).toHaveLength(1);
      expect(exposureWarnings()[0]).toContain("0.0.0.0");
    } finally {
      await runtime.dispose();
    }
  });

  test("a network host does not warn when code execution is off", () =>
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
