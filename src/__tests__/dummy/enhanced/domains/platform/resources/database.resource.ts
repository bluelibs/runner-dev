import { defineResource } from "@bluelibs/runner";
import { DatabaseConfigSchema } from "../../../schemas";

type DatabaseValue = {
  client: "postgresql";
  database: string;
  status: "connecting" | "ready" | "draining";
};

export const databaseResource = defineResource({
  id: "database",
  configSchema: DatabaseConfigSchema,
  meta: {
    title: "Primary Database",
    description:
      "Models the main transactional database used by the reference app.\n\n- Gives ORM and repositories a believable owner\n- Adds lifecycle surfaces for docs cards and topology",
  },
  init: async (config): Promise<DatabaseValue> => ({
    client: config.client,
    database: config.database,
    status: "connecting",
  }),
  ready: async (value) => {
    value.status = "ready";
  },
  cooldown: async (value) => {
    value.status = "draining";
  },
  dispose: async (value) => {
    value.status = "draining";
  },
  health: async (value) => ({
    status: value?.status === "ready" ? "healthy" : "degraded",
    details: value
      ? `${value.client}:${value.database}`
      : "database-not-initialized",
  }),
});
