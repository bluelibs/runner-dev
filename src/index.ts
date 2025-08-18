import { resource } from "@bluelibs/runner";

import { server } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";
import { dev } from "./resources/dev.resource";

Error.stackTraceLimit = Infinity;

export const resources = {
  server,
  introspector,
  live,
  telemetry,
  swapManager,
  graphql,
  dev,
};

export { dev };
