import { dev } from "@bluelibs/runner-dev";

// Example: Basic runner-dev usage (in-memory only)
export const basicExample = dev.with({
  port: 3000,
  maxEntries: 5000,
});

// Example: Runner-dev with SQLite persistence
export const persistentExample = dev.with({
  port: 3000,
  maxEntries: 10000,
  database: {
    driver: "sqlite",
    options: {
      filePath: "./telemetry.db",
    },
  },
});

// Example: Runner-dev with schema persistence only (no telemetry DB)
export const schemaPersistenceExample = dev.with({
  port: 3000,
  maxEntries: 5000,
  database: {
    driver: "sqlite", 
    options: {
      filePath: "./runner-schema.db", // Schema snapshots will be saved to runner-schema_schemas.json
    },
  },
});

export default persistentExample;