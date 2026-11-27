import { createHash } from "node:crypto";
import type Redis from "ioredis";
import z from "zod";
import { remoteHistory } from "./store";

export const redisHistoryConfig = z
  .object({ url: z.string().url(), streamId: z.string().min(1) })
  .strict();
export async function redisHistory(config: z.infer<typeof redisHistoryConfig>) {
  const url = new URL(config.url);
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use a redis(s) endpoint and REDIS_USERNAME/REDIS_PASSWORD for credentials."
    );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const driver: typeof import("ioredis") = require("ioredis");
  const client: Redis = new driver.Redis(config.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 10000,
    commandTimeout: 10000,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  });
  client.on("error", () => {});
  try {
    await client.connect();
  } catch (error) {
    client.disconnect();
    throw error;
  }
  const key =
    "runner-dev:history:" +
    createHash("sha256").update(config.streamId).digest("hex");
  return remoteHistory({
    async read() {
      return Object.entries(await client.hgetall(key)).map(
        ([slot, record]) => ({ slot, record })
      );
    },
    async commit(changes, revision) {
      await client.eval(
        `
        local meta = redis.call('HGET', KEYS[1], 'meta')
        if (meta and cjson.decode(meta).revision or 0) ~= tonumber(ARGV[1])-1 then
          return redis.error_reply('Live history stream has another writer')
        end
        for _,row in ipairs(cjson.decode(ARGV[2])) do
          if row.record=='' then redis.call('HDEL',KEYS[1],row.slot)
          else redis.call('HSET',KEYS[1],row.slot,row.record) end
        end`,
        1,
        key,
        revision,
        JSON.stringify(changes)
      );
    },
    async close() {
      client.disconnect();
    },
  });
}
