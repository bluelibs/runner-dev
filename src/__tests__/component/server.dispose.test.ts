import http from "node:http";
import { once } from "node:events";
import { connect, type AddressInfo, type Socket } from "node:net";
import { SHUTDOWN_GRACE_MS } from "../../resources/httpServerShutdown";
import { startServer } from "./serverHarness";

/** Opens the live stream and resolves once its first frame arrived. */
async function openLiveStream(port: number) {
  const request = http.get({
    host: "127.0.0.1",
    port,
    path: "/live/stream",
    headers: { Host: `localhost:${port}` },
  });
  const [response] = (await once(request, "response")) as [
    http.IncomingMessage
  ];
  expect(response.statusCode).toBe(200);
  await once(response, "data");
  const ended = new Promise<void>((resolve) => {
    response.on("end", resolve);
    response.resume();
  });
  return { request, ended };
}

/** Resolves once `condition` holds, checking every few milliseconds. */
async function waitUntil(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Whether `promise` settles within `ms`. Lets a test fail on a hang instead
 * of blocking until Jest's timeout with the hanging work still running.
 */
async function settlesWithin(
  promise: Promise<unknown>,
  ms: number
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([promise.then(() => true), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends a request without its final blank line and waits until the server
 * has read it, so the request is still arriving when shutdown begins: such a
 * connection is busy, and `server.close()` leaves it open.
 */
async function startUnfinishedRequest(httpServer: http.Server, path: string) {
  const { port } = httpServer.address() as AddressInfo;
  const accepted = new Promise<Socket>((resolve) =>
    httpServer.once("connection", resolve)
  );
  const client = connect(port, "127.0.0.1");
  const head = `GET ${path} HTTP/1.1\r\nHost: localhost:${port}\r\n`;
  client.write(head);
  const serverSide = await accepted;
  await waitUntil(() => serverSide.bytesRead >= Buffer.byteLength(head));

  let received = "";
  client.on("data", (chunk) => (received += chunk.toString()));
  const closedByServer = once(client, "end");
  return {
    client,
    finish: () => client.write("\r\n"),
    responseHead: async () => {
      await waitUntil(() => received.includes("\r\n\r\n"));
      return received.slice(0, received.indexOf("\r\n\r\n")).toLowerCase();
    },
    closedByServer,
  };
}

describe("server shutdown", () => {
  test("ends open live streams instead of waiting on them forever", async () => {
    const { runtime, server } = await startServer({ port: 0 });
    const { port } = server.httpServer.address() as AddressInfo;
    const stream = await openLiveStream(port);

    try {
      const startedAt = Date.now();
      await runtime.dispose();
      // Well under Node's 5 s keep-alive timeout: the stream's socket must
      // close with the stream, not linger as an idle keep-alive connection.
      expect(Date.now() - startedAt).toBeLessThan(2_000);
      await stream.ended;
      expect(server.httpServer.listening).toBe(false);
    } finally {
      stream.request.destroy();
    }
  });

  // close() has already dropped idle sockets when this request completes,
  // so a keep-alive answer would hold shutdown for Node's keep-alive
  // timeout, and an EventSource reconnecting on that socket would hold it
  // for as long as it keeps retrying.
  test("closes the connection of a stream requested while shutting down", async () => {
    const { runtime, server } = await startServer({ port: 0 });
    const request = await startUnfinishedRequest(
      server.httpServer,
      "/live/stream"
    );

    try {
      const disposed = runtime.dispose();
      // close() runs right after the open streams are ended.
      await waitUntil(() => !server.httpServer.listening);
      const finishedAt = Date.now();
      request.finish();

      const head = await request.responseHead();
      expect(head).toContain("connection: close");
      expect(head).not.toContain("keep-alive");
      await request.closedByServer;
      await disposed;
      expect(Date.now() - finishedAt).toBeLessThan(1_000);
    } finally {
      request.client.destroy();
    }
  });

  // Node stops enforcing header timeouts once the server closes, so without
  // a deadline this connection would keep dispose waiting forever.
  test(
    "cuts a connection whose request never completes after the grace period",
    async () => {
      const { runtime, server } = await startServer({ port: 0 });
      const request = await startUnfinishedRequest(
        server.httpServer,
        "/graphql"
      );

      const startedAt = Date.now();
      const disposed = runtime.dispose();
      try {
        expect(await settlesWithin(disposed, SHUTDOWN_GRACE_MS + 1_000)).toBe(
          true
        );
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(
          SHUTDOWN_GRACE_MS - 100
        );
        await request.closedByServer;
      } finally {
        // Unblocks a dispose that is still waiting, so a failure ends here.
        request.client.destroy();
        await disposed;
      }
    },
    SHUTDOWN_GRACE_MS + 5_000
  );
});
