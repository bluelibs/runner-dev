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

    expect(
      sections.some((section) =>
        ["live", "telemetry", "logs"].includes(section.id)
      )
    ).toBe(false);
  });
});

test("puts Telemetry and Logs alongside Live in runtime navigation", () => {
  const sections = createSections({
    tasks: 0,
    resources: 0,
    events: 0,
    hooks: 0,
    middlewares: 0,
    tags: 0,
    errors: 0,
    asyncContexts: 0,
    topologyConnections: 0,
  });
  expect(sections.slice(0, 3).map(({ id, label }) => ({ id, label }))).toEqual([
    { id: "live", label: "Live" },
    { id: "telemetry", label: "Telemetry" },
    { id: "logs", label: "Logs" },
  ]);
});
