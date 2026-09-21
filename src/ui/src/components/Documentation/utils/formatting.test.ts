import { getCoverageColor } from "./formatting";

describe("getCoverageColor", () => {
  it("returns the success token for full coverage", () => {
    expect(getCoverageColor(100)).toBe("var(--docs-success)");
    expect(getCoverageColor(120)).toBe("var(--docs-success)");
  });

  it("returns the warning token for partial coverage", () => {
    expect(getCoverageColor(80)).toBe("var(--docs-warning)");
    expect(getCoverageColor(99)).toBe("var(--docs-warning)");
  });

  it("returns the danger token for low coverage", () => {
    expect(getCoverageColor(79)).toBe("var(--docs-danger)");
    expect(getCoverageColor(0)).toBe("var(--docs-danger)");
  });
});
