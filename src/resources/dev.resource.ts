import { resource } from "@bluelibs/runner";
import { telemetry } from "./telemetry.resource";
import { serverResource } from "./server.resource";
import { graphql } from "./graphql-accumulator.resource";
import { swapManager } from "./swap.resource";
import { introspector } from "./introspector.resource";
import { live } from "./live.resource";
import { schemaPersistence } from "./schema-persistence.resource";
import { registerHttpRoutes } from "./routeHandlers/registerHttpRoutes.hook";
import { graphqlQueryTask } from "./graphql.query.task";
import z from "zod";
import { DatabaseConfig } from "../database";

export type DevConfig = {
  port?: number;
  maxEntries?: number;
  database?: DatabaseConfig;
};

export const dev = resource({
  id: "runner-dev.resources.dev",
  meta: {
    title: "Development Environment",
    description:
      "Main development resource that registers all necessary components for Runner-Dev including server, GraphQL, telemetry, and HTTP routes",
  },
  configSchema: z.object({
    port: z.number().min(1).max(65535).optional(),
    maxEntries: z.number().min(1).optional(),
    database: z.object({
      driver: z.literal("sqlite"),
      options: z.object({
        filePath: z.string(),
      }),
    }).optional(),
  }),
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
      database: config.database,
    }),
    ...(config.database ? [schemaPersistence.with({ database: config.database })] : []),
    registerHttpRoutes,
    graphqlQueryTask,
  ],
});
