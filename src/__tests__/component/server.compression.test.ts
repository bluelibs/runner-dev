import express from "express";
import request from "supertest";
import { createResponseCompression } from "../../resources/responseCompression";
import { createTextResponse } from "../../resources/textResponse";
import { startServer } from "./serverHarness";

const large = "repeated json value ".repeat(1000);

describe("default HTTP compression", () => {
  test("compresses GraphQL JSON on the actual Runner Dev server", async () => {
    const { server, runtime } = await startServer({ port: 0 });
    try {
      const query =
        "{ first: resources { id } second: resources { id } third: resources { id } fourth: resources { id } }";
      const compressed = await request(server.httpServer)
        .post("/graphql")
        .set("Accept-Encoding", "gzip")
        .send({ query });
      expect(compressed.status).toBe(200);
      expect(compressed.body.errors).toBeUndefined();
      expect(compressed.headers["content-encoding"]).toBe("gzip");
      const identity = await request(server.httpServer)
        .post("/graphql")
        .set("Accept-Encoding", "identity")
        .send({ query });
      expect(identity.headers["content-encoding"]).toBeUndefined();
      expect(identity.body).toEqual(compressed.body);
    } finally {
      await runtime.dispose();
    }
  });

  test("negotiates compression for REST, skips small/binary/no-transform/SSE bodies and avoids double gzip", async () => {
    const app = express();
    app.use(createResponseCompression());
    app.get(
      "/prepared",
      createTextResponse(JSON.stringify({ large }), "application/json")
    );
    app.get("/json", (_req, res) => res.json({ large }));
    app.get("/small", (_req, res) => res.json({ ok: true }));
    app.get("/binary", (_req, res) =>
      res.type("image/png").send(Buffer.alloc(2000))
    );
    app.get("/unchanged", (_req, res) =>
      res.set("Cache-Control", "no-transform").json({ large })
    );
    app.get("/sse", (_req, res) =>
      res.type("text/event-stream").send(`data: ${large}\n\n`)
    );
    const gzip = await request(app).get("/json").set("Accept-Encoding", "gzip");
    expect(gzip.headers["content-encoding"]).toBe("gzip");
    expect(gzip.body).toEqual({ large });
    const prepared = await request(app)
      .get("/prepared")
      .set("Accept-Encoding", "gzip");
    expect(prepared.headers["content-encoding"]).toBe("gzip");
    expect(prepared.body).toEqual({ large });
    const brotli = await request(app).get("/json").set("Accept-Encoding", "br");
    expect(brotli.headers["content-encoding"]).toBe("br");
    expect(brotli.body).toEqual({ large });
    for (const url of ["/small", "/binary", "/unchanged", "/sse"]) {
      const response = await request(app)
        .get(url)
        .set("Accept-Encoding", "gzip");
      expect(response.headers["content-encoding"]).toBeUndefined();
    }
    const disabled = await request(app)
      .get("/json")
      .set("Accept-Encoding", "gzip;q=0, identity");
    expect(disabled.headers["content-encoding"]).toBeUndefined();
  });
});
