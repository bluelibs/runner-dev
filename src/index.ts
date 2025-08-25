import { resource } from "@bluelibs/runner";

import { serverResource } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";
import { dev } from "./resources/dev.resource";
import { coverage } from "./resources/coverage.resource";

Error.stackTraceLimit = Infinity;

export const resources = {
  server: serverResource,
  introspector,
  live,
  telemetry,
  swapManager,
  graphql,
  dev,
  coverage,
};

export { dev };
