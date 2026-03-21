import { createSections } from "./documentationSections";

describe("createSections", () => {
  test("omits the Live section in catalog mode", () => {
    const sections = createSections({
      mode: "catalog",
      tasks: 1,
      resources: 1,
      events: 1,
      hooks: 1,
      middlewares: 1,
      tags: 1,
      errors: 1,
      asyncContexts: 1,
      topologyConnections: 1,
    });

    expect(sections.some((section) => section.id === "live")).toBe(false);
  });
});
