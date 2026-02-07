import { resource } from "@bluelibs/runner";

import { serverResource } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";
import { dev } from "./resources/dev.resource";
import { coverage } from "./resources/coverage.resource";

export type { ServerConfig, ServerInstance } from "./resources/server.resource";

Error.stackTraceLimit = Infinity;

// Explicit type prevents TS2742 when @bluelibs/runner is linked locally
// (duplicate @types/express-serve-static-core in the runner package)
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
