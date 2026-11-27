import { defineResource } from "@bluelibs/runner";
import { redisHistory, redisHistoryConfig } from "./redis";
import { postgresHistory, postgresHistoryConfig } from "./postgres";
import { clickHouseHistory, clickHouseHistoryConfig } from "./clickhouse";

export const redisPersistenceResource = defineResource({
  id: "redisPersistence",
  configSchema: redisHistoryConfig,
  init: redisHistory,
  async dispose(store) {
    await store.close();
  },
});
export const postgresPersistenceResource = defineResource({
  id: "postgresPersistence",
  configSchema: postgresHistoryConfig,
  init: postgresHistory,
  async dispose(store) {
    await store.close();
  },
});
export const clickHousePersistenceResource = defineResource({
  id: "clickHousePersistence",
  configSchema: clickHouseHistoryConfig,
  init: clickHouseHistory,
  async dispose(store) {
    await store.close();
  },
});
