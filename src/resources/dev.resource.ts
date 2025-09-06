import { resource } from "@bluelibs/runner";
import { telemetry } from "./telemetry.resource";
import { serverResource } from "./server.resource";
import { graphql } from "./graphql-accumulator.resource";
import { swapManager } from "./swap.resource";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { registerHttpRoutes } from "./routeHandlers/registerHttpRoutes.hook";
import { graphqlQueryTask } from "./graphql.query.task";

export type DevConfig = {
  port?: number;
  maxEntries?: number;
};

export const dev = resource({
  id: "runner-dev.resources.dev",
  meta: {
    title: "Development Environment",
    description: "Main development resource that registers all necessary components for Runner-Dev including server, GraphQL, telemetry, and HTTP routes",
  },
  register: (config: DevConfig) => [
    introspector,
    telemetry,
    serverResource.with({
      port: config.port,
    }),
    graphql,
    swapManager,
    live.with({
      maxEntries: config.maxEntries,
    }),
    registerHttpRoutes,
    graphqlQueryTask,
  ],
});
