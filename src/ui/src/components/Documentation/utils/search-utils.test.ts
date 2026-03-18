import {
  elementMatchesParsed,
  parseSearchQuery,
  treeNodeMatchesParsed,
} from "./search-utils";

describe("search-utils wildcard matching", () => {
  test("supports wildcard matching for element id filters", () => {
    const parsed = parseSearchQuery("app.tasks.*");
    expect(
      elementMatchesParsed({ id: "app.tasks.create", tags: [] }, parsed)
    ).toBe(true);
    expect(
      elementMatchesParsed({ id: "app.resources.cache", tags: [] }, parsed)
    ).toBe(false);
  });

  test("supports wildcard matching for tag search mode", () => {
    const parsed = parseSearchQuery(":domain.*");
    expect(
      elementMatchesParsed(
        { id: "task.1", tags: ["domain.user", "feature.auth"] },
        parsed
      )
    ).toBe(true);
    expect(
      elementMatchesParsed(
        { id: "task.2", tags: ["feature.auth", "ops.trace"] },
        parsed
      )
    ).toBe(false);
  });

  test("supports wildcard matching in tree node filtering", () => {
    const parsed = parseSearchQuery("app.*.create*");
    expect(
      treeNodeMatchesParsed(
        {
          label: "Create User",
          elementId: "app.tasks.createUser",
        },
        parsed
      )
    ).toBe(true);
    expect(
      treeNodeMatchesParsed(
        {
          label: "Delete User",
          elementId: "app.tasks.deleteUser",
        },
        parsed
      )
    ).toBe(false);
  });

  test("matches bare resource/task filters by element kind", () => {
    const resourceParsed = parseSearchQuery("RESOURCE");
    expect(
      elementMatchesParsed(
        { id: "app.cache", tags: [], kind: "resource" },
        resourceParsed
      )
    ).toBe(true);
    expect(
      elementMatchesParsed(
        { id: "app.cleanup", tags: [], kind: "task" },
        resourceParsed
      )
    ).toBe(false);

    const kindOrParsed = parseSearchQuery("task|resource");
    expect(
      treeNodeMatchesParsed(
        {
          label: "cache",
          elementId: "app.cache",
          type: "resource",
        },
        kindOrParsed
      )
    ).toBe(true);
    expect(
      treeNodeMatchesParsed(
        {
          label: "cleanup",
          elementId: "app.cleanup",
          type: "event",
        },
        kindOrParsed
      )
    ).toBe(false);
  });
});
