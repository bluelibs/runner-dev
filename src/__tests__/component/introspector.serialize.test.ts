import { resource, run } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { introspector as introspectorResource } from "../../resources/introspector.resource";
import { Introspector } from "../../resources/models/Introspector";

describe("Introspector serialize/deserialize", () => {
  test("round-trip preserves core graph and works without store", async () => {
    let inst: any;
    const probe = resource({
      id: "probe.serialize",
      dependencies: { introspector: introspectorResource },
      async init(_config, { introspector }) {
        inst = introspector;
      },
    });

    const app = createDummyApp([introspectorResource, probe]);
    await run(app);

    const originalTaskMiddlewareCount = inst.getTaskMiddlewares().length;
    const originalResourceMiddlewareCount =
      inst.getResourceMiddlewares().length;

    // Serialize
    const data = inst.serialize();
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(Array.isArray(data.resources)).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
    expect(Array.isArray(data.middlewares)).toBe(true);

    // Deserialize on a frontend-like environment (no store)
    const clientInst = Introspector.deserialize(data);

    // Basic APIs should work
    expect(clientInst.getTasks().length).toBeGreaterThan(0);
    expect(clientInst.getResources().length).toBeGreaterThan(0);
    expect(clientInst.getEvents().length).toBeGreaterThan(0);
    expect(clientInst.getMiddlewares().length).toBeGreaterThan(0);
    expect(clientInst.getTaskMiddlewares().length).toBe(
      originalTaskMiddlewareCount
    );
    expect(clientInst.getResourceMiddlewares().length).toBe(
      originalResourceMiddlewareCount
    );

    // Root should be available
    const root = clientInst.getRoot();
    expect(root).toBeTruthy();

    // Lookups should work
    const hello = clientInst.getTask("task.hello");
    expect(hello?.id).toBe("task.hello");

    // Tag aggregations should work
    const tags = clientInst.getAllTags();
    expect(Array.isArray(tags)).toBe(true);

    // Diagnostics can be called client-side
    const diags = clientInst.getDiagnostics();
    expect(Array.isArray(diags)).toBe(true);

    // runOptions should survive round-trip
    const opts = clientInst.getRunOptions();
    expect(opts).toBeDefined();
    expect(typeof opts.mode).toBe("string");
    expect(["dev", "test", "prod"]).toContain(opts.mode);
    expect(typeof opts.debug).toBe("boolean");
    expect(opts.debugMode === null || typeof opts.debugMode === "string").toBe(
      true
    );
    expect(typeof opts.logsEnabled).toBe("boolean");
    expect(
      opts.logsPrintThreshold === null ||
        typeof opts.logsPrintThreshold === "string"
    ).toBe(true);
    expect(
      opts.logsPrintStrategy === null ||
        typeof opts.logsPrintStrategy === "string"
    ).toBe(true);
    expect(typeof opts.logsBuffer).toBe("boolean");
    expect(
      opts.errorBoundary === null || typeof opts.errorBoundary === "boolean"
    ).toBe(true);
    expect(
      opts.shutdownHooks === null || typeof opts.shutdownHooks === "boolean"
    ).toBe(true);
    expect(typeof opts.dryRun).toBe("boolean");
    expect(typeof opts.lazy).toBe("boolean");
    expect(["sequential", "parallel"]).toContain(opts.lifecycleMode);
    expect(
      opts.disposeBudgetMs === null || typeof opts.disposeBudgetMs === "number"
    ).toBe(true);
    expect(
      opts.disposeDrainBudgetMs === null ||
        typeof opts.disposeDrainBudgetMs === "number"
    ).toBe(true);
    expect(
      opts.runtimeEventCycleDetection === null ||
        typeof opts.runtimeEventCycleDetection === "boolean"
    ).toBe(true);
    expect(typeof opts.hasOnUnhandledError).toBe("boolean");
    expect(typeof opts.rootId).toBe("string");
    expect(opts.rootId).toBeTruthy();
  });
});
