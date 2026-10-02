import { defineResource } from "@bluelibs/runner";
import {
  clickHouseApmConfigSchema,
  clickHouseApmPersistence,
} from "./clickHouseApmPersistence";

export const clickHouseApmPersistenceResource = defineResource({
  id: "clickHouseApmPersistence",
  meta: {
    title: "ClickHouse APM Persistence",
    description:
      "Batched compact task and hook samples with bounded background writes and TTL retention.",
  },
  configSchema: clickHouseApmConfigSchema,
  async init(config) {
    return clickHouseApmPersistence(config);
  },
  async dispose(store) {
    await store.close();
  },
});
