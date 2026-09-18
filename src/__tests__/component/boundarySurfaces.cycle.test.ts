import { buildBoundarySurfaces } from "../../resources/models/boundarySurfaces";
import type { Resource } from "../../schema";

function resource(
  id: string,
  registers: string[],
  exports: string[]
): Resource {
  return {
    id,
    registers,
    isolation: {
      deny: [],
      only: [],
      whitelist: [],
      exports,
      exportsMode: "list",
    },
  } as unknown as Resource;
}

describe("boundary surfaces cycles", () => {
  test("tolerates cyclic exports instead of throwing", () => {
    const surfaces = buildBoundarySurfaces([
      resource("a", ["b"], ["b"]),
      resource("b", ["a"], ["a"]),
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
    const surfaces = buildBoundarySurfaces([resource("a", [], ["a"])]);

    expect(surfaces.find((s) => s.ownerId === "a")?.effectiveExports).toEqual([
      "a",
    ]);
  });

  test("keeps acyclic exports unchanged", () => {
    const surfaces = buildBoundarySurfaces([
      resource("a", ["b"], ["b"]),
      resource("b", [], []),
    ]);

    expect(surfaces.find((s) => s.ownerId === "a")?.effectiveExports).toEqual([
      "b",
    ]);
    expect(surfaces.find((s) => s.ownerId === "b")?.effectiveExports).toEqual(
      []
    );
  });
});
