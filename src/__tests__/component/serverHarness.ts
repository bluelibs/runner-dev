import {
  run,
  defineResource,
  resources as runnerResources,
} from "@bluelibs/runner";
import { once } from "node:events";
import { resources } from "../../index";
import type { ServerConfig } from "../../resources/server.resource";
import { createDummyApp } from "../dummy/dummyApp";

/**
 * Boots the dev server resources on a real socket and records warn logs, so
 * tests can assert on binding, routing and shutdown end to end.
 */
export async function startServer(config: ServerConfig) {
  const warnings: string[] = [];
  const logProbe = defineResource({
    id: "server-harness-log-probe",
    dependencies: { logger: runnerResources.logger },
    async init(_config, { logger }) {
      logger.onLog((log) => {
        if (log.level === "warn") warnings.push(String(log.message));
      });
    },
  });
  const runtime = await run(
    createDummyApp([
      logProbe,
      resources.introspector,
      resources.telemetry,
      resources.server.with(config),
      resources.graphql,
      resources.swapManager,
      resources.live,
    ]),
    { shutdownHooks: false, logs: { printThreshold: null } }
  );
  const server = runtime.getResourceValue(resources.server);
  // The server resource resolves before its socket is bound.
  if (!server.httpServer.listening) {
    await once(server.httpServer, "listening");
  }
  const exposureWarnings = () =>
    warnings.filter((message) =>
      message.includes("reachable from the network")
    );
  return { runtime, server, exposureWarnings };
}
