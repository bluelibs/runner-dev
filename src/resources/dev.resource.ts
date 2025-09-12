import { resource } from "@bluelibs/runner";
import { telemetry } from "./telemetry.resource";
import { serverResource } from "./server.resource";
import { graphql } from "./graphql-accumulator.resource";
import { swapManager } from "./swap.resource";
import { introspector } from "./introspector.resource";
import { introspectorWithPersistence } from "./introspector-with-persistence.resource";
import { schemaPersistence } from "./schema-persistence.resource";
import { live } from "./live.resource";
import { registerHttpRoutes } from "./routeHandlers/registerHttpRoutes.hook";
import { graphqlQueryTask } from "./graphql.query.task";
import { database, databaseConfigSchema, DatabaseConfig } from "./database.resource";
import z from "zod";

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
    database: databaseConfigSchema.optional(),
  }),
  register: (config: DevConfig) => {
    const resources: any[] = [
      // Use enhanced introspector if database is configured, otherwise use standard
      config.database 
        ? introspectorWithPersistence.with({ database: config.database })
        : introspector,
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
      registerHttpRoutes,
      graphqlQueryTask,
    ];

    // Add persistence-related resources when database is configured
    if (config.database) {
      resources.push(
        schemaPersistence.with({ database: config.database }),
        database.with(config.database)
      );
    }

    return resources;
  },
});
