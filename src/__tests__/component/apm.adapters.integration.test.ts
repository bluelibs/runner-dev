import { clickHouseApmPersistence } from "../../resources/live/clickHouseApmPersistence";
import { redisApmPersistence } from "../../resources/live/redisApmPersistence";
import type { RunRecord } from "../../resources/live/types";
import type { ApmRetention } from "../../resources/live/apmPersistence";
const providers = [
  {
    name: "clickhouse",
    url: process.env.APM_CLICKHOUSE_TEST_URL,
    create: clickHouseApmPersistence,
  },
  {
    name: "redis",
    url: process.env.APM_REDIS_TEST_URL,
    create: redisApmPersistence,
  },
];
for (const provider of providers) {
  const testProvider = provider.url ? it : it.skip;
  testProvider(
    `${provider.name}: shared byte/day/count policy survives restarts and isolates streams`,
    async () => {
      const options = {
        url: provider.url!,
        streamId: `retention-${provider.name}-${Date.now()}`,
        flushIntervalMs: 60000,
      };
      const policy: ApmRetention = {
        maxSamples: 5,
        maxStorage: 524288,
        retentionDays: 7,
      };
      const sample = (
        sequence: number,
        timestampMs = Date.now()
      ): RunRecord => ({
        sequence,
        timestampMs,
        nodeId: "é".repeat(75000),
        nodeKind: "TASK",
        durationMs: 1,
        ok: true,
        correlationId: "private",
        error: "secret",
      });
      const first = await provider.create(options);
      try {
        await first.load(policy);
        for (let index = 1; index <= 7; index++)
          first.append(
            sample(index, index === 1 ? Date.now() - 8 * 86400000 : Date.now())
          );
        await first.flush();
      } finally {
        await first.close();
      }
      const second = await provider.create(options);
      try {
        const restored = await second.load(policy);
        expect(restored.samples.map((run) => run.sequence)).toEqual([5, 6, 7]);
        expect(
          restored.samples.every((run) => !run.error && !run.correlationId)
        ).toBe(true);
        expect(
          restored.samples.reduce(
            (total, run) => total + Buffer.byteLength(JSON.stringify(run)),
            0
          )
        ).toBeLessThanOrEqual(policy.maxStorage!);
        expect(restored.lastSequence).toBe(7);
        const cutoff = Date.now() + 1000;
        const empty = await second.load({
          ...policy,
          cutoffTimestampMs: cutoff,
        });
        expect(empty.samples).toEqual([]);
        expect(empty.lastSequence).toBe(7);
      } finally {
        await second.close();
      }
      const unrelated = await provider.create({
        ...options,
        streamId: options.streamId + "-other",
      });
      try {
        expect((await unrelated.load({ maxSamples: 1 })).samples).toEqual([]);
      } finally {
        await unrelated.close();
      }
    },
    30000
  );
}

const testRedis = process.env.APM_REDIS_TEST_URL ? it : it.skip;
testRedis(
  "Redis validates the whole batch before writing and respects a zero date cutoff",
  async () => {
    const options = {
      url: process.env.APM_REDIS_TEST_URL!,
      streamId: `atomic-${Date.now()}`,
      flushIntervalMs: 60000,
    };
    const sample: RunRecord = {
      sequence: 2,
      timestampMs: -100,
      nodeId: "old",
      nodeKind: "TASK",
      durationMs: 1,
      ok: true,
    };
    const first = await redisApmPersistence(options);
    await first.load({ maxSamples: 10 });
    first.append(sample);
    first.append({ ...sample, sequence: 1 });
    await expect(first.flush()).rejects.toThrow("sequences must increase");
    await expect(first.close()).rejects.toThrow("sequences must increase");
    const after = await redisApmPersistence(options);
    try {
      expect(await after.load({ maxSamples: 10 })).toEqual({
        samples: [],
        lastSequence: 0,
      });
      after.append(sample);
      await after.flush();
      expect((await after.load({ maxSamples: 10 })).samples).toHaveLength(1);
      expect(
        await after.load({ maxSamples: 10, cutoffTimestampMs: 0 })
      ).toEqual({ samples: [], lastSequence: 2 });
    } finally {
      await after.close();
    }
  }
);
