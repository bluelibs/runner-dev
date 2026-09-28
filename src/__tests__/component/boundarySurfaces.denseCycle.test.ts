import { buildBoundarySurfaces } from "../../resources/models/boundarySurfaces";
import type { IsolationExportsMode, Resource } from "../../schema";

type ExportsReadCounter = { reads: number };

/**
 * Builds a resource whose `isolation.exports` getter counts reads, so the
 * test can assert how often each owner's exports are expanded without
 * reaching into boundarySurfaces internals.
 */
function countedResource(
  id: string,
  options: {
    registers?: string[];
    exports?: string[];
    exportsMode?: IsolationExportsMode;
    counter: ExportsReadCounter;
  }
): Resource {
  const exports = options.exports ?? [];
  const { counter } = options;
  return {
    id,
    emits: [],
    dependsOn: [],
    middleware: [],
    overrides: [],
    registers: options.registers ?? [],
    isolation: {
      deny: [],
      only: [],
      whitelist: [],
      exportsMode: options.exportsMode ?? "list",
      get exports() {
        counter.reads += 1;
        return exports;
      },
    },
  };
}

function denseCycleIds(size: number): string[] {
  return Array.from({ length: size }, (_, index) => `node-${index}`);
}

function effectiveExportsByOwner(resources: Resource[]): Map<string, string[]> {
  return new Map(
    buildBoundarySurfaces(resources).map((surface) => [
      surface.ownerId,
      surface.effectiveExports,
    ])
  );
}

/**
 * Naive reference: effective exports are everything reachable through
 * "list" owners, plus the registered elements of reachable "unset" owners.
 * Registers in the generated graphs are leaf ids, so no nesting is needed.
 */
function referenceEffectiveExports(
  owner: Resource,
  resourcesById: Map<string, Resource>
): string[] {
  const isolation = owner.isolation;
  if (!isolation || isolation.exportsMode === "unset") {
    return [...owner.registers].sort();
  }

  const reached = new Set<string>();
  const expanded = new Set<string>([owner.id]);
  const pending = [owner];
  while (pending.length > 0) {
    const current = pending.pop();
    const currentIsolation = current?.isolation;
    if (!currentIsolation || currentIsolation.exportsMode !== "list") continue;
    for (const exportedId of currentIsolation.exports) {
      reached.add(exportedId);
      const exported = resourcesById.get(exportedId);
      if (!exported || expanded.has(exportedId)) continue;
      expanded.add(exportedId);
      const exportedMode = exported.isolation?.exportsMode ?? "unset";
      if (exportedMode === "list") pending.push(exported);
      if (exportedMode === "unset") {
        exported.registers.forEach((id) => reached.add(id));
      }
    }
  }
  return [...reached].sort();
}

/** Small deterministic LCG so generated graphs are stable across runs. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomExportGraph(seed: number, size: number): Resource[] {
  const random = seededRandom(seed);
  const counter: ExportsReadCounter = { reads: 0 };
  const ids = denseCycleIds(size);
  const modes: IsolationExportsMode[] = [
    "list",
    "list",
    "list",
    "none",
    "unset",
  ];
  return ids.map((id) =>
    countedResource(id, {
      exportsMode: modes[Math.floor(random() * modes.length)],
      registers: [`${id}-task`],
      exports: [...ids, `${id}-task`, "missing-resource"].filter(
        () => random() < 0.35
      ),
      counter,
    })
  );
}

describe("boundary surfaces dense export cycles", () => {
  test("expands every owner a bounded number of times", () => {
    const counter: ExportsReadCounter = { reads: 0 };
    const ids = denseCycleIds(7);
    // Every resource exports every other one: a single strongly-connected
    // region whose simple paths grow factorially with its size.
    const resources = ids.map((id) =>
      countedResource(id, {
        exports: ids.filter((otherId) => otherId !== id),
        counter,
      })
    );

    const surfaces = effectiveExportsByOwner(resources);

    for (const id of ids) {
      expect(surfaces.get(id)).toEqual([...ids].sort());
    }
    // One expansion per owner plus one read for `declaredExports`.
    expect(counter.reads).toBeLessThanOrEqual(ids.length * 2);
  });

  test("keeps results identical to the reachability closure", () => {
    const counter: ExportsReadCounter = { reads: 0 };
    const resources = [
      // a <-> b <-> c form one cycle; c also leaves the cycle.
      countedResource("a", { exports: ["b", "task-a"], counter }),
      countedResource("b", { exports: ["a", "c"], counter }),
      countedResource("c", { exports: ["b", "leaf", "sealed"], counter }),
      // A second cycle reached from the first one.
      countedResource("leaf", { exports: ["leaf-peer", "task-leaf"], counter }),
      countedResource("leaf-peer", { exports: ["leaf"], counter }),
      countedResource("sealed", {
        exportsMode: "none",
        registers: ["task-sealed"],
        counter,
      }),
      countedResource("open", {
        exportsMode: "unset",
        registers: ["task-open"],
        counter,
      }),
      countedResource("uses-open", { exports: ["open", "ghost"], counter }),
    ];

    const expectedCycle = [
      "a",
      "b",
      "c",
      "leaf",
      "leaf-peer",
      "sealed",
      "task-a",
      "task-leaf",
    ];
    const expectedLeaf = ["leaf", "leaf-peer", "task-leaf"];

    const forward = effectiveExportsByOwner(resources);
    const reversed = effectiveExportsByOwner([...resources].reverse());

    for (const surfaces of [forward, reversed]) {
      expect(surfaces.get("a")).toEqual(expectedCycle);
      expect(surfaces.get("b")).toEqual(expectedCycle);
      expect(surfaces.get("c")).toEqual(expectedCycle);
      expect(surfaces.get("leaf")).toEqual(expectedLeaf);
      expect(surfaces.get("leaf-peer")).toEqual(expectedLeaf);
      expect(surfaces.get("sealed")).toEqual([]);
      expect(surfaces.get("open")).toEqual(["task-open"]);
      expect(surfaces.get("uses-open")).toEqual(["ghost", "open", "task-open"]);
    }
  });

  test("matches a naive reachability reference on generated graphs", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const resources = randomExportGraph(seed, 8);
      const resourcesById = new Map(
        resources.map((resource) => [resource.id, resource])
      );
      const surfaces = effectiveExportsByOwner(resources);

      for (const resource of resources) {
        expect({
          seed,
          owner: resource.id,
          exports: surfaces.get(resource.id),
        }).toEqual({
          seed,
          owner: resource.id,
          exports: referenceEffectiveExports(resource, resourcesById),
        });
      }
    }
  });
});
