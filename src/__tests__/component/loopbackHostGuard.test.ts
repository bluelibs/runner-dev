import express from "express";
import request from "supertest";
import {
  LOOPBACK_HOST_REJECTION_MESSAGE,
  createLoopbackHostGuard,
  isLoopbackBindHost,
  isLoopbackHostHeader,
  parseHostHeaderHostname,
} from "../../resources/routeHandlers/loopbackHostGuard";

describe("isLoopbackBindHost", () => {
  test.each([
    "127.0.0.1",
    "127.1.2.3",
    "localhost",
    "LOCALHOST",
    "::1",
    "[::1]",
  ])("%p is loopback", (host) => {
    expect(isLoopbackBindHost(host)).toBe(true);
  });

  test.each(["0.0.0.0", "::", "192.168.1.10", "example.com", "128.0.0.1"])(
    "%p is not loopback",
    (host) => {
      expect(isLoopbackBindHost(host)).toBe(false);
    }
  );
});

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

describe("isLoopbackHostHeader", () => {
  test.each(["localhost:1337", "127.0.0.1:1337", "[::1]:1337", "localhost"])(
    "accepts %p",
    (hostHeader) => {
      expect(isLoopbackHostHeader(hostHeader)).toBe(true);
    }
  );

  test.each([
    undefined,
    "",
    "evil.example",
    "localhost.evil.example:1337",
    "127.0.0.1.nip.io",
    "0.0.0.0:1337",
  ])("rejects %p", (hostHeader) => {
    expect(isLoopbackHostHeader(hostHeader)).toBe(false);
  });
});

describe("createLoopbackHostGuard", () => {
  const app = express();
  app.use(createLoopbackHostGuard());
  app.get("/ping", (_req, res) => {
    res.send("pong");
  });

  test("lets loopback Host headers through", async () => {
    const response = await request(app).get("/ping").set("Host", "localhost");
    expect(response.status).toBe(200);
    expect(response.text).toBe("pong");
  });

  test("rejects foreign Host headers with a clear 403", async () => {
    const response = await request(app)
      .get("/ping")
      .set("Host", "rebind.evil.example:1337");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      errors: [{ message: LOOPBACK_HOST_REJECTION_MESSAGE }],
    });
  });
});
