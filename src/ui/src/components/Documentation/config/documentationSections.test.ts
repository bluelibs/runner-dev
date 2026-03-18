import { createSections } from "./documentationSections";

describe("createSections", () => {
  it("keeps the primary sections list free of docs support entries", () => {
    const sections = createSections({
      tasks: 1,
      resources: 1,
      events: 1,
      hooks: 1,
      middlewares: 1,
      tags: 1,
      errors: 0,
      asyncContexts: 0,
      topologyConnections: 3,
    });

    const sectionIds = sections.map((section) => section.id);
    expect(sectionIds).toEqual([
      "live",
      "diagnostics",
      "overview",
      "topology",
      "tasks",
      "resources",
      "events",
      "hooks",
      "middlewares",
      "tags",
    ]);
  });
});
