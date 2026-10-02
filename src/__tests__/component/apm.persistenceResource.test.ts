import { defineResource, defineTask, run } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { createApm } from "../../resources/live/apm";
import { resources as devResources } from "../../index";
import { live } from "../../resources/live.resource";
import { telemetry } from "../../resources/telemetry.resource";
import type { ApmPersistence } from "../../resources/live/apmPersistence";

it("auto-registers an APM adapter and flushes it before provider disposal", async () => {
  const calls: string[] = [];
  const append = jest.fn(() => undefined);
  const provider = defineResource({
    id: "apm-provider",
    async init(): Promise<ApmPersistence> {
      return {
        storage: "custom",
        load: async () => ({ samples: [], lastSequence: 0 }),
        append,
        flush: async () => {
          calls.push("flush");
        },
      };
    },
    async dispose() {
      calls.push("dispose");
    },
  });
  const task = defineTask({
    id: "apm-task",
    async run() {
      return "done";
    },
  });
  const runtime = await run(
    createDummyApp([
      live.with({ apm: { persistence: provider } }),
      telemetry,
      task,
    ]),
    { logs: { printThreshold: null } }
  );
  await runtime.runTask(task);
  expect(append).toHaveBeenCalledWith(
    expect.objectContaining({ nodeKind: "TASK", ok: true })
  );
  expect(runtime.getResourceValue(live).getApm?.().storage).toBe("custom");
  await runtime.dispose();
  expect(calls).toEqual(["flush", "dispose"]);
});

it("accepts minimal typed ClickHouse configuration", () => {
  const configured = devResources.clickHouseApmPersistence.with({
    url: "http://localhost:8123",
    streamId: "typed-config",
  });
  expect(configured).toBeDefined();
});

it("rejects async enqueue implementations supplied by JavaScript providers", () => {
  const provider: ApmPersistence = {
    storage: "invalid",
    load: async () => ({ samples: [], lastSequence: 0 }),
    append: () => undefined,
    flush: async () => {},
  };
  Object.assign(provider, {
    append: async () => {
      throw new Error("background rejection");
    },
  });
  const resource = defineResource({
    id: "invalid-provider",
    async init() {
      return provider;
    },
  });
  const apm = createApm({ persistence: resource }, provider, {
    samples: [],
    lastSequence: 0,
  });
  expect(() =>
    apm.record({
      sequence: 1,
      timestampMs: Date.now(),
      nodeId: "task",
      nodeKind: "TASK",
      durationMs: 1,
      ok: true,
    })
  ).toThrow("enqueue synchronously");
  expect(apm.snapshot().retainedSamples).toBe(0);
});
