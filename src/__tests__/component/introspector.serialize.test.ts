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
  });
});
