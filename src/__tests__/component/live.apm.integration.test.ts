import {
  defineResource,
  defineTask,
  defineEvent,
  defineHook,
  run,
} from "@bluelibs/runner";
import { live } from "../../resources/live.resource";
import { telemetry } from "../../resources/telemetry.resource";

it("collects direct and nested completions once, including failures, independently of trace eviction", async () => {
  const child = defineTask({
    id: "child",
    async run() {
      return 1;
    },
  });
  const parent = defineTask({
    id: "parent",
    dependencies: { child },
    async run(_, { child }) {
      return child();
    },
  });
  const failure = defineTask({
    id: "failure",
    async run() {
      throw new Error("task failed");
    },
  });
  const app = defineResource({
    id: "app",
    register: [
      child,
      parent,
      failure,
      telemetry,
      live.with({ maxEntries: 1, apm: { storage: "memory", maxSamples: 10 } }),
    ],
  });
  const runtime = await run(app);
  try {
    await runtime.runTask(parent);
    await expect(runtime.runTask(failure)).rejects.toThrow("task failed");
    const service = await runtime.getResourceValue(live);
    expect(service.getRuns()).toHaveLength(1);
    const all = service.getApm?.();
    expect(all?.tasks).toHaveLength(3);
    expect(
      all?.tasks.find((task) => task.taskId.endsWith("failure"))
    ).toMatchObject({ count: 1, failures: 1 });
    expect(service.getApm?.(30, "direct").tasks).toHaveLength(2);
    expect(service.getApm?.(30, "nested").tasks).toHaveLength(1);
  } finally {
    await runtime.dispose();
  }
});

it("measures hook reactions and their delegated tasks without merging their counts", async () => {
  const orderPlaced = defineEvent({ id: "order-placed" });
  const child = defineTask({
    id: "save-order",
    async run() {
      await new Promise((resolve) => setTimeout(resolve, 2));
    },
  });
  const reaction = defineHook({
    id: "on-order",
    on: orderPlaced,
    dependencies: { child },
    async run(_, { child }) {
      await child();
    },
  });
  const app = defineResource({
    id: "app",
    register: [
      orderPlaced,
      child,
      reaction,
      telemetry,
      live.with({ apm: { storage: "memory" } }),
    ],
  });
  const runtime = await run(app);
  try {
    await runtime.emitEvent(orderPlaced);
    const service = await runtime.getResourceValue(live);
    const snapshot = service.getApm?.();
    const task = snapshot?.tasks.find((entry) =>
      entry.taskId.endsWith("save-order")
    );
    const hook = snapshot?.hooks.find((entry) =>
      entry.hookId.endsWith("on-order")
    );
    expect(task).toMatchObject({ count: 1, failures: 0 });
    expect(hook).toMatchObject({ count: 1, failures: 0 });
    expect(hook!.meanMs).toBeGreaterThanOrEqual(task!.meanMs);
    const taskRun = service
      .getRuns()
      .find((entry) => entry.nodeId === task?.taskId);
    expect(taskRun?.parentId).toBe(hook?.hookId);
    expect(service.getApm?.(30, "direct").tasks).toEqual([]);
    expect(service.getApm?.(30, "nested").hooks).toHaveLength(1);
  } finally {
    await runtime.dispose();
  }
});

it("records a failed hook once and retains its failed completion", async () => {
  const changed = defineEvent({ id: "changed" });
  const reaction = defineHook({
    id: "failed-reaction",
    on: changed,
    async run() {
      throw new Error("reaction failed");
    },
  });
  const app = defineResource({
    id: "app",
    register: [
      changed,
      reaction,
      telemetry,
      live.with({ apm: { storage: "memory" } }),
    ],
  });
  const runtime = await run(app);
  try {
    await expect(runtime.emitEvent(changed)).rejects.toThrow("reaction failed");
    const service = await runtime.getResourceValue(live);
    expect(service.getApm?.().hooks).toEqual([
      expect.objectContaining({ count: 1, failures: 1, errorRate: 1 }),
    ]);
    expect(service.getRuns()).toEqual([
      expect.objectContaining({
        nodeKind: "HOOK",
        ok: false,
        error: "reaction failed",
      }),
    ]);
  } finally {
    await runtime.dispose();
  }
});
