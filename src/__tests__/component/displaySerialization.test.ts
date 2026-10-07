import { definitions, r, resources, run } from "@bluelibs/runner";
import { stringifyIfObject } from "../../resources/models/introspector.tools";
import { initializeFromStore } from "../../resources/models/initializeFromStore";
import { Introspector } from "../../resources/models/Introspector";

function sharedGraph(depth: number) {
  let resource: definitions.IResource = r.resource("leaf").build();
  for (let index = 0; index < depth; index++) {
    resource = r
      .resource(`layer${index}`)
      .register([resource])
      .dependencies({ left: resource, right: resource })
      .build();
  }
  return resource;
}

describe("bounded config display", () => {
  test("collapses shared definition graphs before traversal and preserves configured settings", () => {
    const dependency = sharedGraph(20);
    const tools = r
      .resource<{ port: number }>("tools")
      .dependencies({ dependency })
      .build();
    const config = {
      developmentTools: [tools.with({ port: 1337 })],
      flags: { debug: true },
    };
    expect(JSON.parse(stringifyIfObject(config)!)).toEqual({
      developmentTools: [
        { $runner: "resource", id: "tools", config: { port: 1337 } },
      ],
      flags: { debug: true },
    });
    expect(config.developmentTools[0].resource).toBe(tools);
    expect(stringifyIfObject(config)!.length).toBeLessThan(200);
  });

  test("keeps settings that happen to have an id and preserves ordinary JSON values", () => {
    const value = {
      id: "settings",
      list: [null, undefined, false, 0],
      date: new Date("2026-10-07"),
      empty: {},
      absent: undefined,
    };
    expect(stringifyIfObject(value)).toBe(JSON.stringify(value));
    expect(stringifyIfObject(null)).toBeNull();
    expect(stringifyIfObject("hello")).toBe("hello");
    expect(stringifyIfObject(1n)).toBe('"1n"');
  });

  test("handles cycles, deep/wide values, large strings and getters without a giant intermediate JSON", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(stringifyIfObject(cycle)).toContain("[Circular]");
    const shared = { enabled: true };
    expect(stringifyIfObject({ a: shared, b: shared })).toBe(
      JSON.stringify({ a: shared, b: shared })
    );
    let deep: unknown = {};
    for (let index = 0; index < 100; index++) deep = { deep };
    for (const value of [
      deep,
      new Array(100_000).fill(1),
      "x".repeat(1_000_000),
    ]) {
      const result = stringifyIfObject(value)!;
      expect(result).toContain("[Truncated]");
      expect(result.length).toBeLessThan(150_000);
    }
    const getter = jest.fn(() => {
      throw new Error("must not run");
    });
    expect(
      stringifyIfObject(Object.defineProperty({}, "hidden", { get: getter }))
    ).toContain("[Getter]");
    expect(getter).not.toHaveBeenCalled();
  });

  test("keeps all 1100 tasks and reconstructs compact tag relations after JSON transport", async () => {
    const tag = r.tag("catalog").build();
    const tasks = Array.from({ length: 1100 }, (_, index) =>
      r
        .task(`task${index}`)
        .tags([tag])
        .run(async () => index)
        .build()
    );
    const dependency = sharedGraph(8);
    const operator = r
      .resource("operators")
      .register([dependency, tag, ...tasks])
      .build();
    const app = r
      .resource<{ developmentTools: unknown[] }>("simulation")
      .register([operator])
      .build();
    const runtime = await run(app.with({ developmentTools: [operator] }), {
      logs: { printThreshold: null },
    });
    try {
      const store = runtime.getResourceValue(resources.store);
      const introspector = new Introspector({ store });
      initializeFromStore(introspector, store);
      const full = introspector.serialize();
      const compact = introspector.serialize({ compactTagRelations: true });
      const body = JSON.stringify(compact);
      const hydrated = Introspector.deserialize(JSON.parse(body));
      expect(compact.tasks).toHaveLength(1100);
      expect(hydrated.getTasks()).toHaveLength(1100);
      const fullTag = full.tags.find((entry) => entry.id.endsWith(".catalog"))!;
      const hydratedTag = hydrated.getTag(fullTag.id)!;
      expect(hydratedTag.tasks.map((entry) => entry.id)).toEqual(
        fullTag.tasks.map((entry) => entry.id)
      );
      expect(hydratedTag.tasks[0]).toBe(hydrated.getTask(fullTag.tasks[0].id));
      expect(JSON.stringify(compact.tags).length).toBeLessThan(
        JSON.stringify(full.tags).length / 10
      );
      expect(hydrated.getRoot().config!.length).toBeLessThan(200);
      expect(body.length).toBeLessThan(2_000_000);
      expect(
        Introspector.deserialize(JSON.parse(JSON.stringify(full))).getTag(
          fullTag.id
        )?.tasks
      ).toHaveLength(1100);
    } finally {
      await runtime.dispose();
    }
  });
});
