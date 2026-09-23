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

const MAX_ENTRIES_MESSAGE =
  "maxEntries must be a positive integer: the number of entries kept per live telemetry category.";
const ALLOWED_HOST_MESSAGE =
  'allowedHosts entries are hostnames without scheme or port, e.g. "devbox.lan".';

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
    // A scheme or port would never equal a Host hostname, so such an entry
    // would silently allow nothing; reject it where it is written.
    allowedHosts: z
      .array(
        z
          .string()
          .min(1, ALLOWED_HOST_MESSAGE)
          .regex(/^[^:/\s]+$/, ALLOWED_HOST_MESSAGE)
      )
      .optional(),
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
