import { server } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/dev.telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";
import { resource } from "@bluelibs/runner";

export const resources = {
  server,
  introspector,
  live,
  telemetry,
  swapManager,
  graphql,
};

export const dev = resource({
  id: "runner-dev.resources.dev",
  register: [
    resources.server,
    resources.introspector,
    resources.live,
    resources.telemetry,
    resources.swapManager,
    resources.graphql,
  ],
});
