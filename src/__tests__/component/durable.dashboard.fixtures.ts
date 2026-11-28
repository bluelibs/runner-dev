import {
  defineEvent,
  defineResource,
  defineTask,
  resources,
  run,
} from "@bluelibs/runner";
import {
  durableEventBridgeResource,
  durableEventTag,
  durableSupportResource,
  durableWorkflowTag,
  memoryDurableResource,
} from "@bluelibs/runner/node";
import express from "express";
import type { Server } from "node:http";
import { once } from "node:events";
import request from "supertest";
import z from "zod";
import { z as z3 } from "zod/v3";
import { createDurableRouter } from "../../durable/router";
import { createHttpPasswordGuard } from "../../resources/routeHandlers/httpPasswordGuard";

export async function fixture(withRuntimes = true, legacySchemas = false) {
  const left = memoryDurableResource.fork("left");
  const right = memoryDurableResource.fork("right");
  const approved = defineEvent({
    id: "approved",
    payloadSchema: z.object({ approved: z.boolean() }),
  });
  const receipt = defineEvent({
    id: "receipt",
    meta: {
      title: "Receipt issued",
      description: "Deliver the receipt after settlement.",
    },
    tags: [durableEventTag.with({ key: "receipt-issued", durable: right })],
  });
  const inputSchema = legacySchemas
    ? z3.object({
        name: z3.string().min(1),
        wait: z3.boolean().default(false),
      })
    : z.object({
        name: z.string().min(1),
        wait: z.boolean().default(false),
      });
  const makeWorkflow = (id: string, durable: typeof left) =>
    defineTask({
      id,
      dependencies: { durable },
      inputSchema,
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
            receipt,
            durableEventBridgeResource.with({
              applyTo: [approved],
              defaultDurable: left,
            }),
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
  const seedSchedule = (id: string, interval: number, name: string) =>
    runtime
      .getResourceValue(left)
      .ensureSchedule(
        store.resolveRegisteredDefinition(leftTask),
        { name, wait: false },
        { id, interval }
      );
  return {
    seedSchedule,
    runtime,
    server,
    client,
    auth,
    prefix,
    get,
    post,
    logger,
  };
}

export async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
