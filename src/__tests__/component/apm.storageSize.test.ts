import { createApm } from "../../resources/live/apm";
import { parseStorageSize } from "../../resources/live/storageSize";
import type { RunRecord } from "../../resources/live/types";
import { defineResource } from "@bluelibs/runner";
const sample = (nodeId: string): RunRecord => ({
  sequence: 1,
  timestampMs: Date.now(),
  nodeId,
  nodeKind: "TASK",
  durationMs: 1,
  ok: true,
});
it.each([
  ["512kb", 524288],
  [" 1 MiB ", 1048576],
  ["1.5mb", 1572864],
  [524288, 524288],
])("parses %s as %s bytes", (size, bytes) => {
  expect(parseStorageSize(size)).toBe(bytes);
});
it.each([
  "511kb",
  "1tb",
  "-1mb",
  "0.1b",
  Infinity,
  Number.MAX_SAFE_INTEGER + 1,
])("rejects invalid storage budget %s", (size) => {
  expect(() => createApm({ storage: "memory", maxStorage: size })).toThrow();
});
it("evicts oldest UTF-8 samples to meet byte and count limits together", () => {
  const apm = createApm({
    storage: "memory",
    maxStorage: "512kb",
    maxSamples: 5,
  });
  for (let index = 0; index < 7; index++)
    apm.record(sample(`${index}:${"é".repeat(75000)}`));
  const snapshot = apm.snapshot();
  expect(snapshot.retainedBytes).toBeLessThanOrEqual(524288);
  expect(snapshot.retainedSamples).toBe(3);
  expect(snapshot.tasks.map((task) => task.taskId[0]).sort()).toEqual([
    "4",
    "5",
    "6",
  ]);
  expect(() => apm.record(sample("x".repeat(524288)))).toThrow(
    "exceeds maxStorage"
  );
  expect(apm.snapshot().retainedSamples).toBe(3);
});
it("maxStorage can replace maxSamples and rejects oversized records before persistence", () => {
  const append = jest.fn(() => undefined);
  const provider = {
    storage: "custom",
    append,
    load: async () => ({ samples: [], lastSequence: 0 }),
    flush: async () => undefined,
  };
  const persistence = defineResource({
    id: "byte-policy",
    async init() {
      return provider;
    },
  });
  const apm = createApm({ maxStorage: "1mb", persistence }, provider);
  expect(apm.snapshot().maxSamples).toBe(10000000);
  expect(() => apm.record(sample("x".repeat(1048576)))).toThrow(
    "exceeds maxStorage"
  );
  expect(append).not.toHaveBeenCalled();
});
