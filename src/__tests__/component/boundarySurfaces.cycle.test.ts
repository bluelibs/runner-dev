import { buildBoundarySurfaces } from "../../resources/models/boundarySurfaces";
import type { Resource } from "../../schema";

function resource(
  id: string,
  registers: string[],
  isolation: Resource["isolation"]
): Resource {
  return { id, registers, isolation } as Resource;
}

describe("boundary surfaces cycles", () => {
  test("tolerates cyclic exports instead of throwing", () => {
    const surfaces = buildBoundarySurfaces([
      resource("a", ["b"], { exportsMode: "list", exports: ["b"] } as any),
      resource("b", ["a"], { exportsMode: "list", exports: ["a"] } as any),
    ]);

    expect(surfaces.find((s) => s.ownerId === "a")?.effectiveExports).toEqual([
      "a",
      "b",
    ]);
    expect(surfaces.find((s) => s.ownerId === "b")?.effectiveExports).toEqual([
      "a",
      "b",
    ]);
  });

  test("tolerates self exports", () => {
    const surfaces = buildBoundarySurfaces([
      resource("a", [], { exportsMode: "list", exports: ["a"] } as any),
    ]);

    expect(surfaces.find((s) => s.ownerId === "a")?.effectiveExports).toEqual([
      "a",
    ]);
  });

  test("keeps acyclic exports unchanged", () => {
    const surfaces = buildBoundarySurfaces([
      resource("a", ["b"], { exportsMode: "list", exports: ["b"] } as any),
      resource("b", [], { exportsMode: "list", exports: [] } as any),
    ]);

    expect(surfaces.find((s) => s.ownerId === "a")?.effectiveExports).toEqual([
      "b",
    ]);
    expect(surfaces.find((s) => s.ownerId === "b")?.effectiveExports).toEqual(
      []
    );
  });
});
