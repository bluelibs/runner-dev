import express from "express";
import request from "supertest";
import { createTextResponse } from "../../resources/textResponse";
import {
  createDocsDataRouteHandler,
  type DocsRouteConfig,
} from "../../resources/routeHandlers/getDocsData";
import * as docs from "../../resources/docsPayload";

const payload: docs.DocsPagePayload = {
  mode: "live",
  introspectorData: {
    tasks: [],
    hooks: [],
    resources: [],
    events: [],
    middlewares: [],
    tags: [],
  },
  runnerFrameworkMd: "x".repeat(20_000),
  runnerDevMd: "dev",
  docsContent: { minimalMd: "minimal", completeMd: "complete" },
  projectOverviewMd: "overview",
};

function appFor(handler: express.RequestHandler) {
  const app = express();
  app.get("/docs/data", handler);
  return app;
}

describe("docs response delivery", () => {
  afterEach(() => jest.restoreAllMocks());

  test("negotiates gzip, private revalidation and weak ETags", async () => {
    const app = appFor(
      createTextResponse(JSON.stringify(payload), "application/json")
    );
    const gzip = await request(app)
      .get("/docs/data")
      .set("Accept-Encoding", "gzip");
    expect(gzip.body).toEqual(payload);
    expect(gzip.headers["content-encoding"]).toBe("gzip");
    expect(Number(gzip.headers["content-length"])).toBeLessThan(1000);
    expect(gzip.headers["cache-control"]).toBe("private, no-cache");
    expect(gzip.headers.vary).toBe("Accept-Encoding");
    const unchanged = await request(app)
      .get("/docs/data")
      .set("If-None-Match", `"other", ${gzip.headers.etag}`);
    expect(unchanged.status).toBe(304);
    const identity = await request(app)
      .get("/docs/data")
      .set("Accept-Encoding", "gzip;q=0, *;q=1");
    expect(identity.headers["content-encoding"]).toBeUndefined();
    expect(identity.body).toEqual(payload);
    expect(identity.headers.etag).toBe(gzip.headers.etag);
    const wildcard = await request(app)
      .get("/docs/data")
      .set("Accept-Encoding", "*;q=0.5");
    expect(wildcard.headers["content-encoding"]).toBe("gzip");
    const invalid = await request(app)
      .get("/docs/data")
      .set("Accept-Encoding", "gzip;q=invalid");
    expect(invalid.headers["content-encoding"]).toBeUndefined();
  });

  test("coalesces concurrent builds, expires, separates namespaces and retries failed builds", async () => {
    const build = jest
      .spyOn(docs, "buildDocsPagePayload")
      .mockResolvedValue(payload);
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const config = {
      logger: { info: jest.fn() },
    } as unknown as DocsRouteConfig;
    const app = appFor(createDocsDataRouteHandler(config));
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => request(app).get("/docs/data"))
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(build).toHaveBeenCalledTimes(1);
    await request(app)
      .get("/docs/data")
      .set("If-None-Match", responses[0].headers.etag)
      .expect(304);
    expect(build).toHaveBeenCalledTimes(1);
    now.mockReturnValue(6001);
    await request(app).get("/docs/data").expect(200);
    expect(build).toHaveBeenCalledTimes(2);
    await request(app).get("/docs/data?namespace=other").expect(200);
    expect(build.mock.calls[2][0].namespacePrefix).toBe("other");
    build.mockRejectedValueOnce(new Error("retry me"));
    await request(app).get("/docs/data?namespace=failed").expect(500);
    await request(app).get("/docs/data?namespace=failed").expect(200);
    expect(build).toHaveBeenCalledTimes(5);
  });
});
