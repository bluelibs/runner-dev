import { run } from "@bluelibs/runner";
import request from "supertest";
import { resources } from "../../index";
import { createDummyApp } from "../dummy/dummyApp";

describe("HTTP routes", () => {
  test("renders the Apollo landing page at GET /graphql", async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.telemetry,
      resources.server.with({
        port: 0,
      }),
      resources.graphql,
      resources.swapManager,
      resources.live,
    ]);
    const runtime = await run(app, { shutdownHooks: false });

    try {
      const server = await runtime.getResourceValue(resources.server);

      const response = await request(server.app)
        .get("/graphql")
        .set("Accept", "text/html");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.text).toContain("Apollo Sandbox");
    } finally {
      await runtime.dispose();
    }
  });
});
