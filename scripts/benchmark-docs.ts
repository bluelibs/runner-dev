import { definitions, r, resources, run } from "@bluelibs/runner";
import express from "express";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { gunzipSync } from "node:zlib";
import { buildDocsPagePayload } from "../src/resources/docsPayload";
import { Introspector } from "../src/resources/models/Introspector";
import { createDocsDataRouteHandler } from "../src/resources/routeHandlers/getDocsData";

// A shared DAG reproduces the operator definitions embedded in root config.
// Seven unique resources repeat through registration and two dependency edges.
let shared: definitions.IResource = r.resource("leaf").build();
for (let index = 0; index < 6; index++) {
  shared = r
    .resource(`shared${index}`)
    .register([shared])
    .dependencies({ left: shared, right: shared })
    .build();
}
const tag = r.tag("catalog").build();
const tasks = Array.from({ length: 1000 }, (_, index) =>
  r
    .task(`task${index}`)
    .dependencies({ shared })
    .tags([tag])
    .meta({
      title: `Task ${index}`,
      description: "Representative application task",
    })
    .run(async () => index)
    .build()
);
const operators = r
  .resource("operators")
  .register([shared, tag, ...tasks])
  .build();
const app = r
  .resource<{ developmentTools: unknown[] }>("simulation")
  .register([operators])
  .build();
const config = { developmentTools: [operators] };

async function main() {
  const runtime = await run(app.with(config), {
    logs: { printThreshold: null },
  });
  try {
    const store = runtime.getResourceValue(resources.store);
    const introspector = new Introspector({ store });
    const start = performance.now();
    const optimized = await buildDocsPagePayload({ store, introspector });
    const optimizedBody = JSON.stringify(optimized);
    const optimizedMs = performance.now() - start;

    const baselineStart = performance.now();
    const originalConfig = JSON.stringify(config);
    const fullGraph = introspector.serialize();
    const baseline = JSON.stringify({
      ...optimized,
      introspectorData: {
        ...fullGraph,
        resources: fullGraph.resources.map((resource) =>
          resource.id === "simulation"
            ? { ...resource, config: originalConfig }
            : resource
        ),
      },
    });
    const baselineMs = performance.now() - baselineStart;
    const hydrateStart = performance.now();
    const hydrated = Introspector.deserialize(
      JSON.parse(optimizedBody).introspectorData
    );
    const hydrateMs = performance.now() - hydrateStart;
    if (
      hydrated.getTasks().length !== 1000 ||
      hydrated.getTag("simulation.operators.tags.catalog")?.tasks.length !==
        1000
    ) {
      throw new Error(
        "The optimized catalog lost task definitions or tag relations."
      );
    }

    const serverApp = express();
    let builds = 0;
    serverApp.get(
      "/docs/data",
      createDocsDataRouteHandler({
        store,
        introspector,
        logger: {
          info: () => {
            builds++;
          },
        },
      })
    );
    const server = serverApp.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const port = (server.address() as AddressInfo).port;
      async function read(etag?: string) {
        const requestStart = performance.now();
        return new Promise<{
          bytes: number;
          ms: number;
          status: number;
          etag?: string;
          body: Buffer;
        }>((resolve, reject) => {
          const req = request(
            {
              hostname: "127.0.0.1",
              port,
              path: "/docs/data",
              headers: {
                "Accept-Encoding": "gzip",
                ...(etag ? { "If-None-Match": etag } : {}),
              },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => {
                const body = Buffer.concat(chunks);
                resolve({
                  bytes: body.length,
                  ms: performance.now() - requestStart,
                  status: res.statusCode ?? 0,
                  etag: res.headers.etag,
                  body,
                });
              });
              res.on("error", reject);
            }
          );
          req.on("error", reject);
          req.end();
        });
      }
      const cold = await read();
      const decoded = JSON.parse(gunzipSync(cold.body).toString());
      if (decoded.introspectorData.tasks.length !== 1000)
        throw new Error("HTTP payload lost tasks");
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => read())
      );
      const unchanged = await read(cold.etag);
      console.log(
        JSON.stringify(
          {
            fixture:
              "1000 tasks, shared dependency DAG embedded in operator root config",
            baseline: {
              configBytes: Buffer.byteLength(originalConfig),
              payloadBytes: Buffer.byteLength(baseline),
              serializationMs: +baselineMs.toFixed(2),
            },
            optimized: {
              configBytes: Buffer.byteLength(hydrated.getRoot().config ?? ""),
              payloadBytes: Buffer.byteLength(optimizedBody),
              buildAndSerializationMs: +optimizedMs.toFixed(2),
              hydrationMs: +hydrateMs.toFixed(2),
              taskCount: hydrated.getTasks().length,
            },
            http: {
              coldGzipBytes: cold.bytes,
              coldMs: +cold.ms.toFixed(2),
              cachedMedianMs: +concurrent
                .map((item) => item.ms)
                .sort((a, b) => a - b)[4]
                .toFixed(2),
              buildsForTenRequests: builds,
              conditionalStatus: unchanged.status,
              conditionalBytes: unchanged.bytes,
            },
          },
          null,
          2
        )
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  } finally {
    await runtime.dispose();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
