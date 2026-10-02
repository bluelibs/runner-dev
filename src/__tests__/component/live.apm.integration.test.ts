import { defineResource, defineTask, run } from "@bluelibs/runner";
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
