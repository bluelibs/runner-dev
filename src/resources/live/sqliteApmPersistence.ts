import { compactApmSample } from "./apmSample";
import { apmRetentionSchema } from "./apmRetention";
import type { ApmRetention } from "./apmPersistence";
import type { RunRecord } from "./types";
import { validatePersistenceSnapshot } from "./persistence.schema";
import { sqliteWorkerClient } from "./sqliteWorkerClient";
import { bufferedApmWriter } from "./bufferedApmWriter";

export function sqliteApmPersistence(file: string) {
  const client = sqliteWorkerClient("apm", file);
  let policy: ApmRetention = { maxSamples: 10_000 };
  let restoring = false;
  const writer = bufferedApmWriter<RunRecord>(async (samples) => {
    await client.request({ operation: "apm-write", samples });
  });
  return {
    storage: "sqlite",
    append(sample: RunRecord) {
      client.assertReady();
      if (restoring)
        throw new Error("Wait for SQLite restoration before recording.");
      return writer.append(compactApmSample(sample, policy.maxStorage));
    },
    flush() {
      if (client.error())
        return Promise.reject(
          new Error(client.error() ?? "SQLite worker failed.")
        );
      return writer.flush();
    },
    status() {
      const state = writer.status();
      return { ...state, error: state.error ?? client.error() };
    },
    async load(options: ApmRetention) {
      writer.assertReady();
      client.assertReady();
      if (restoring)
        throw new Error("SQLite restoration is already in progress.");
      restoring = true;
      try {
        await writer.flush();
        policy = apmRetentionSchema.parse(options);
        const response = await client.request({
          operation: "apm-load",
          options: policy,
        });
        if (response.operation !== "apm-load")
          throw new Error("Unexpected SQLite load response.");
        validatePersistenceSnapshot({
          entries: response.snapshot.samples.map((entry) => ({
            kind: "run",
            entry,
          })),
          lastSequence: response.snapshot.lastSequence,
        });
        return response.snapshot;
      } finally {
        restoring = false;
      }
    },
    async close() {
      try {
        await writer.close();
      } finally {
        await client.close();
      }
    },
  };
}
