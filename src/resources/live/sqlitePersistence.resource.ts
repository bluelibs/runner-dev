import { defineResource } from "@bluelibs/runner";
import z from "zod";
import { sqlitePersistence } from "./sqlitePersistence";

export const sqlitePersistenceResource = defineResource({
  id: "sqlitePersistence",
  meta: {
    title: "SQLite Telemetry Persistence",
    description:
      "Stores retained live telemetry in a runtime-scoped SQLite database.",
  },
  configSchema: z.object({
    file: z
      .string()
      .refine(
        (file) => file.trim().length > 0,
        "SQLite persistence requires a non-empty file path."
      ),
  }),
  async init(config) {
    return sqlitePersistence(config);
  },
  async dispose(store) {
    await store.close();
  },
});
