import { resources, redisApmPersistence } from "../../index";
// Importing the package must work even when this optional client cannot load.
jest.mock("ioredis", () => {
  throw new Error("missing optional dependency");
});
it("loads without Redis and explains the dependency only when selected", async () => {
  expect(resources.redisApmPersistence).toBeDefined();
  await expect(
    redisApmPersistence({ url: "redis://localhost:6379", streamId: "orders" })
  ).rejects.toThrow("optional ioredis package");
});
it("rejects unsafe connection and queue settings before loading Redis", async () => {
  await expect(
    redisApmPersistence({
      url: "redis://user:secret@localhost:6379",
      streamId: "orders",
    })
  ).rejects.toThrow("without credentials");
  await expect(
    redisApmPersistence({ url: "http://localhost:6379", streamId: "orders" })
  ).rejects.toThrow("redis(s)");
  await expect(
    redisApmPersistence({
      url: "redis://localhost:6379",
      streamId: "orders",
      batchSize: 2,
      maxPendingSamples: 1,
    })
  ).rejects.toThrow("at least batchSize");
});
