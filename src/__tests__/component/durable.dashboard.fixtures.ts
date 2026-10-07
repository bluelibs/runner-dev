import {
  defineEvent,
  defineResource,
  defineTask,
  resources,
  run,
} from "@bluelibs/runner";
import {
  durableSupportResource,
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import express from "express";
import type { Server } from "node:http";
import { once } from "node:events";
import request from "supertest";
import z from "zod";
import { createDurableRouter } from "../../durable/router";
import { createHttpPasswordGuard } from "../../resources/routeHandlers/httpPasswordGuard";

export async function fixture(withRuntimes = true) {
  const left = memoryDurableResource.fork("left");
  const right = memoryDurableResource.fork("right");
  const approved = defineEvent({
    id: "approved",
    payloadSchema: z.object({ approved: z.boolean() }),
  });
  const makeWorkflow = (id: string, durable: typeof left) =>
    defineTask({
      id,
      dependencies: { durable },
      inputSchema: z.object({
        name: z.string().min(1),
        wait: z.boolean().default(false),
      }),
      tags: [
        durableWorkflowTag.with({
          key: id,
          signals: [approved],
          metadata: {
            studio: {
              presets: [{ name: "Example", payload: { name: "Ada" } }],
            },
          },
        }),
      ],
      async run(input, { durable }) {
        const context = durable.use();
        await context.step("name", async () => input.name);
        if (input.wait)
          return await context.waitForSignal(approved, { stepId: "approval" });
        return input.name;
      },
    });
  const leftTask = makeWorkflow("leftFlow", left);
  const rightTask = makeWorkflow("rightFlow", right);
  const runtime = await run(
    defineResource<void>({
      id: "dashboardTests",
      register: withRuntimes
        ? [
            durableSupportResource,
            left.with({ audit: { enabled: true } }),
            right.with({ audit: { enabled: true } }),
            approved,
            leftTask,
            rightTask,
          ]
        : [],
    }),
    { logs: { printThreshold: null } }
  );
  const store = runtime.getResourceValue(resources.store);
  const app = express();
  const logger = { info: jest.fn() };
  app.use(createHttpPasswordGuard("dashboard-test"));
  app.use("/durable/api", createDurableRouter(store, logger));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = request(server);
  const auth = `Basic ${Buffer.from("runner:dashboard-test").toString(
    "base64"
  )}`;
  const prefix = "/durable/api";
  const get = (path: string) =>
    client.get(prefix + path).set("Authorization", auth);
  const post = (path: string, body?: Record<string, unknown>) =>
    client
      .post(prefix + path)
      .set("Authorization", auth)
      .send(body);
  return { runtime, server, client, auth, prefix, get, post, logger };
}

export async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
