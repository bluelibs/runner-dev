import { bufferedApmWriter } from "../../resources/live/bufferedApmWriter";
import type { RunRecord } from "../../resources/live/types";
const sample: RunRecord = {
  sequence: 1,
  timestampMs: 1,
  nodeId: "work",
  nodeKind: "TASK",
  ok: true,
  durationMs: 1,
};
it("batches writes, includes records appended during a flush, and drains on shutdown", async () => {
  let finish!: () => void;
  const write = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const writer = bufferedApmWriter(write, {
    batchSize: 2,
    maxPendingSamples: 3,
  });
  writer.append(sample);
  writer.append({ ...sample, sequence: 2 });
  writer.append({ ...sample, sequence: 3 });
  expect(() => writer.append(sample)).toThrow("queue is full");
  const close = writer.close();
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(2);
  finish();
  await close;
  expect(writer.status().pendingSamples).toBe(0);
  expect(() => writer.append(sample)).toThrow("closed");
});
it("latches timer write failures and rejects subsequent writes and shutdown", async () => {
  jest.useFakeTimers();
  const writer = bufferedApmWriter(async () => {
    throw new Error("disk unavailable");
  });
  writer.append(sample);
  await jest.advanceTimersByTimeAsync(1000);
  expect(writer.status().error).toBe("disk unavailable");
  expect(() => writer.append(sample)).toThrow("disk unavailable");
  await expect(writer.close()).rejects.toThrow("disk unavailable");
  jest.useRealTimers();
});
it.each([
  { batchSize: 0 },
  { batchSize: 2, maxPendingSamples: 1 },
  { flushIntervalMs: 0 },
])("rejects invalid queue settings %p", (options) => {
  expect(() => bufferedApmWriter(() => undefined, options)).toThrow();
});
