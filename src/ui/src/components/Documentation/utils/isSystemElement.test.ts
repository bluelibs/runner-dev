import { isSystemElement } from "./isSystemElement";

describe("isSystemElement", () => {
  it("matches the system namespace by id", () => {
    expect(isSystemElement({ id: "system" })).toBe(true);
    expect(isSystemElement({ id: "system.events.ready" })).toBe(true);
    expect(isSystemElement({ id: "system.tags.internal" })).toBe(true);
  });

  it("does not treat nested non-system namespaces as system", () => {
    expect(isSystemElement({ id: "app.system.events.ready" })).toBe(false);
    expect(isSystemElement({ id: "runner.events.ready" })).toBe(false);
  });
});
