import { resource } from "@bluelibs/runner";

import { server } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/dev.telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";

Error.stackTraceLimit = Infinity;

export const resources = {
  server,
  introspector,
  live,
  telemetry,
  swapManager,
  graphql,
};

export type DevConfigType = {
  /**
   * Default port to run the dev server on. (Default: 1337)
   */
  port?: number;
  /**
   * Maximum number of entries to keep in the live resource. (Default: 10000)
   */
  maxEntries?: number;
};

export const dev = resource<DevConfigType>({
  id: "runner-dev.resources.dev",
  register: (c: DevConfigType) => [
    resources.server.with({
      port: c.port,
    }),
    resources.introspector,
    resources.live.with({
      maxEntries: c.maxEntries,
    }),
    resources.telemetry,
    resources.swapManager,
    resources.graphql,
  ],
});
