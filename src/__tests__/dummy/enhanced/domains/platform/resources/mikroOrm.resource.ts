import { defineResource } from "@bluelibs/runner";
import { MikroOrmConfigSchema } from "../../../schemas";
import { databaseResource } from "./database.resource";

type MikroOrmValue = {
  contextName: string;
  debug: boolean;
  repositories: string[];
};

export const mikroOrmResource = defineResource({
  id: "mikro-orm",
  configSchema: MikroOrmConfigSchema,
  dependencies: { databaseResource },
  meta: {
    title: "MikroORM",
    description:
      "Represents the ORM layer sitting on top of the primary database.\n\n- Gives repositories a realistic parent resource\n- Keeps persistence wiring visible without implementing real I/O",
  },
  init: async (config): Promise<MikroOrmValue> => ({
    contextName: config.contextName,
    debug: config.debug,
    repositories: ["CatalogListing", "OrderRecord"],
  }),
  ready: async () => undefined,
  cooldown: async () => undefined,
  dispose: async () => undefined,
  health: async () => ({
    status: "healthy",
    details: "entity-manager-ready",
  }),
});
