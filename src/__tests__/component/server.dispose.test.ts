import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
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
});
