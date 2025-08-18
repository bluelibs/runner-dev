import { resource } from "@bluelibs/runner";
import { telemetry } from "./telemetry.resource";
import { server } from "./server.resource";
import { graphql } from "./graphql-accumulator.resource";
import { swapManager } from "./swap.resource";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";

export type DevConfig = {
  port?: number;
  maxEntries?: number;
};

export const dev = resource({
  id: "runner-dev.resources.dev",
  register: (config: DevConfig) => [
    introspector,
    telemetry,
    server.with({
      port: config.port,
    }),
    graphql,
    swapManager,
    live.with({
      maxEntries: config.maxEntries,
    }),
  ],
});
