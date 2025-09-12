// import { MikroORM, EntityManager } from "@mikro-orm/core";
// import { SqliteDriver } from "@mikro-orm/sqlite";
import { resource } from "@bluelibs/runner";
import z from "zod";
// import {
//   LogEntry,
//   EmissionEntry,
//   ErrorEntry,
//   RunRecord,
//   SchemaSnapshot,
// } from "./models/database";

export interface DatabaseConfig {
  driver: "sqlite";
  options: {
    filePath: string;
  };
}

export const databaseConfigSchema = z.object({
  driver: z.literal("sqlite"),
  options: z.object({
    filePath: z.string(),
  }),
});

export interface DatabaseService {
  // For now, just a placeholder
  // orm: MikroORM<SqliteDriver>;
  // em: EntityManager<SqliteDriver>;
  connected: boolean;
}

export const database = resource({
  id: "runner-dev.database.resources.database",
  meta: {
    title: "Database Service",
    description:
      "Optional database service for persisting telemetry data using MikroORM with SQLite",
  },
  configSchema: databaseConfigSchema,
  async init(config: DatabaseConfig): Promise<DatabaseService> {
    // TODO: Implement MikroORM integration
    console.log("Database configured with filePath:", config.options.filePath);
    
    return {
      connected: true,
    };
  },
  async dispose(service: DatabaseService) {
    // TODO: Implement disposal
    console.log("Database service disposed");
  },
});