import { once } from "node:events";
import { connect, type AddressInfo } from "node:net";
import express from "express";
import request from "supertest";
import {
  createHostGuard,
  hostRejectionMessage,
  isAllowedHostname,
  isLoopbackAddress,
  normalizeHostname,
  parseHostHeaderHostname,
} from "../../resources/routeHandlers/hostGuard";

describe("parseHostHeaderHostname", () => {
  test.each([
    ["localhost:1337", "localhost"],
    ["LocalHost", "localhost"],
    ["127.0.0.1:80", "127.0.0.1"],
    ["[::1]:1337", "::1"],
    ["[::1]", "::1"],
    ["evil.example:1337", "evil.example"],
    ["", null],
    ["[::1", null],
  ])("%p -> %p", (hostHeader, expected) => {
    expect(parseHostHeaderHostname(hostHeader)).toBe(expected);
  });
});

describe("normalizeHostname", () => {
  test.each([
    ["DevBox.LAN", "devbox.lan"],
    [" app ", "app"],
    ["[::1]", "::1"],
    ["::", "::"],
    ["Bücher.lan", "xn--bcher-kva.lan"],
  ])("%p -> %p", (hostname, expected) => {
    expect(normalizeHostname(hostname)).toBe(expected);
  });
});

describe("isAllowedHostname", () => {
  const configured = new Set(["devbox.lan"]);

  // Every loopback and LAN address a client can dial, including the ones a
  // loopback-only allow-list refused (127.0.0.2 is the server's own address
  // when bound there on Linux).
  test.each([
    "localhost",
    "127.0.0.1",
    "127.0.0.2",
    "::1",
    "0.0.0.0",
    "192.168.1.50",
    "fe80::1",
    "devbox.lan",
  ])("allows %p", (hostname) => {
    expect(isAllowedHostname(hostname, configured)).toBe(true);
  });

  test.each([
    "rebind.attacker.example",
    "localhost.evil.example",
    "127.0.0.1.nip.io",
    "app.localhost",
    "devbox",
  ])("refuses %p", (hostname) => {
    expect(isAllowedHostname(hostname, configured)).toBe(false);
  });
});

describe("isLoopbackAddress", () => {
  test.each(["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"])(
    "%p is loopback",
    (address) => {
      expect(isLoopbackAddress(address)).toBe(true);
    }
  );

  test.each(["0.0.0.0", "::", "192.168.1.10", "::ffff:192.168.1.10"])(
    "%p is not loopback",
    (address) => {
      expect(isLoopbackAddress(address)).toBe(false);
    }
  );
});

describe("createHostGuard", () => {
  const app = express();
  app.use(createHostGuard({ allowedHosts: ["DevBox.lan", "bücher.lan"] }));
  app.get("/ping", (_req, res) => {
    res.send("pong");
  });

  // A browser sends "bücher.lan" in punycode, so the Unicode entry must match
  // that form.
  test.each([
    "localhost",
    "127.0.0.2:1337",
    "[::1]:1337",
    "devbox.lan:1337",
    "xn--bcher-kva.lan:1337",
  ])("lets Host %p through", async (hostHeader) => {
    const response = await request(app).get("/ping").set("Host", hostHeader);
    expect(response.status).toBe(200);
    expect(response.text).toBe("pong");
  });

  test("rejects foreign Host headers with a clear 403", async () => {
    const response = await request(app)
      .get("/ping")
      .set("Host", "rebind.evil.example:1337");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      errors: [{ message: hostRejectionMessage("rebind.evil.example") }],
    });
    expect(response.body.errors[0].message).toContain(
      'list that name in allowedHosts, e.g. dev.with({ allowedHosts: ["rebind.evil.example"] })'
    );
  });

  // HTTP/1.0 is the only way to send no Host header at all: Node refuses an
  // HTTP/1.1 request without one before any middleware runs.
  test("rejects a request without a Host header", async () => {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const { port } = server.address() as AddressInfo;
      const response = await new Promise<string>((resolve, reject) => {
        const socket = connect(port, "127.0.0.1", () => {
          socket.write("GET /ping HTTP/1.0\r\n\r\n");
        });
        let received = "";
        socket.on("data", (chunk) => (received += chunk.toString()));
        socket.on("end", () => resolve(received));
        socket.on("error", reject);
      });
      expect(response).toContain("403 Forbidden");
      expect(response).toContain(
        JSON.stringify({ errors: [{ message: hostRejectionMessage(null) }] })
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
