import { defineResource } from "@bluelibs/runner";
import {
  redisApmConfigSchema,
  redisApmPersistence,
} from "./redisApmPersistence";
export const redisApmPersistenceResource = defineResource({
  id: "redisApmPersistence",
  meta: {
    title: "Redis APM Persistence",
    description:
      "Batched compact APM samples with atomic time, count and byte retention.",
  },
  configSchema: redisApmConfigSchema,
  async init(config) {
    return redisApmPersistence(config);
  },
  async dispose(store) {
    await store.close();
  },
});
