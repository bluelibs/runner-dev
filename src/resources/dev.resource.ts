import { defineResource } from "@bluelibs/runner";
import { telemetry } from "./telemetry.resource";
import { serverResource } from "./server.resource";
import { graphql } from "./graphql-accumulator.resource";
import { swapManager } from "./swap.resource";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { registerHttpRoutes } from "./routeHandlers/registerHttpRoutes.hook";
import { graphqlQueryTask } from "./graphql.query.task";
import z from "zod";
import { allowedHostsSchema } from "./allowedHosts.schema";

const MAX_ENTRIES_MESSAGE =
  "maxEntries must be a positive integer: the number of entries kept per live telemetry category.";

export type DevConfig = {
  port?: number;
  host?: string;
  /** DNS names, besides localhost and IP addresses, requests may use. */
  allowedHosts?: string[];
  maxEntries?: number;
};

export const dev = defineResource({
  id: "dev",
  meta: {
    title: "Development Environment",
    description:
      "Main development resource that registers all necessary components for Runner-Dev including server, GraphQL, telemetry, and HTTP routes",
  },
  configSchema: z.object({
    port: z.number().min(1).max(65535).optional(),
    host: z.string().min(1).optional(),
    // An entry that can never equal a Host hostname would silently allow
    // nothing; reject it where it is written.
    allowedHosts: allowedHostsSchema,
    // Validated here, at the config boundary, so a bad value names the
    // setting instead of failing later inside the live store's buffers.
    maxEntries: z
      .number()
      .int(MAX_ENTRIES_MESSAGE)
      .min(1, MAX_ENTRIES_MESSAGE)
      .optional(),
  }),
  register: (config: DevConfig) => [
    introspector,
    telemetry,
    serverResource.with({
      port: config.port,
      host: config.host,
      allowedHosts: config.allowedHosts,
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
