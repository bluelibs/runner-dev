/** @jest-environment node */

import {
  DEFAULT_ELEMENT_TABLE_VIEW,
  getAdjacentSortKey,
  getColumnSortState,
  getUsedByCount,
  getVisibleTableElements,
  nextSortState,
  type BaseElement,
  type ElementTableView,
} from "./elementTable.utils";

const withView = (patch: Partial<ElementTableView>): ElementTableView => ({
  ...DEFAULT_ELEMENT_TABLE_VIEW,
  ...patch,
  filters: { ...DEFAULT_ELEMENT_TABLE_VIEW.filters, ...patch.filters },
});

const ids = (elements: BaseElement[]) => elements.map((element) => element.id);

describe("getUsedByCount", () => {
  it.each<[string, BaseElement, number]>([
    ["plain usedBy", { id: "r", usedBy: ["a", "b"] }, 2],
    [
      "unique task and resource users",
      { id: "m", usedByTasks: ["a", "b"], usedByResources: ["b", "c"] },
      3,
    ],
    ["resource users only", { id: "m", usedByResources: ["c"] }, 1],
    [
      "unique emitters and listeners",
      { id: "e", emittedBy: ["a"], listenedToBy: ["a", "h"] },
      2,
    ],
    ["listeners only", { id: "e", listenedToBy: ["h"] }, 1],
    ["throwers", { id: "x", thrownBy: ["a", "b"] }, 2],
    [
      "every tagged group",
      {
        id: "t",
        tasks: [1],
        hooks: [1],
        resources: [1],
        middlewares: [1],
        taskMiddlewares: [1],
        resourceMiddlewares: [1],
        events: [1],
        errors: [1, 2],
      },
      9,
    ],
    ["nothing to count", { id: "lonely" }, 0],
  ])("counts %s", (_label, element, expected) => {
    expect(getUsedByCount(element)).toBe(expected);
  });
});

describe("getVisibleTableElements", () => {
  const elements: BaseElement[] = [
    {
      id: "app.tasks.createUser",
      type: "task",
      meta: { title: "Create User", description: "Signs a user up" },
      usedBy: ["a"],
    },
    {
      id: "app.resources.logger",
      type: "resource",
      meta: { title: "Logger" },
      usedBy: ["a", "b", "c"],
    },
    { id: "app.events.userCreated", usedBy: [] },
    { id: "app.tasks.deleteUser", type: "task", usedBy: ["a", "b"] },
  ];

  it("returns the source order for the default view", () => {
    expect(
      ids(
        getVisibleTableElements(elements, DEFAULT_ELEMENT_TABLE_VIEW, {
          middlewareTypeFilters: false,
        })
      )
    ).toEqual(ids(elements));
  });

  it("combines fuzzy id/title filters with exact description and count filters", () => {
    const visible = (patch: Partial<ElementTableView>) =>
      ids(
        getVisibleTableElements(elements, withView(patch), {
          middlewareTypeFilters: false,
        })
      );

    expect(
      visible({ filters: { ...DEFAULT_ELEMENT_TABLE_VIEW.filters, id: "usr" } })
    ).toEqual([
      "app.tasks.createUser",
      "app.events.userCreated",
      "app.tasks.deleteUser",
    ]);
    expect(
      visible({
        filters: { ...DEFAULT_ELEMENT_TABLE_VIEW.filters, title: "user" },
      })
    ).toEqual(["app.tasks.createUser"]);
    expect(
      visible({
        filters: {
          ...DEFAULT_ELEMENT_TABLE_VIEW.filters,
          description: " SIGNS ",
        },
      })
    ).toEqual(["app.tasks.createUser"]);
    expect(
      visible({
        filters: { ...DEFAULT_ELEMENT_TABLE_VIEW.filters, usedBy: "3" },
      })
    ).toEqual(["app.resources.logger"]);
  });

  it("applies middleware scope toggles only when the table enables them", () => {
    const tasksHidden = withView({ showTaskMiddlewares: false });
    const resourcesHidden = withView({ showResourceMiddlewares: false });

    expect(
      ids(
        getVisibleTableElements(elements, tasksHidden, {
          middlewareTypeFilters: true,
        })
      )
    ).toEqual(["app.resources.logger", "app.events.userCreated"]);
    expect(
      ids(
        getVisibleTableElements(elements, resourcesHidden, {
          middlewareTypeFilters: true,
        })
      )
    ).toEqual([
      "app.tasks.createUser",
      "app.events.userCreated",
      "app.tasks.deleteUser",
    ]);
    expect(
      getVisibleTableElements(elements, tasksHidden, {
        middlewareTypeFilters: false,
      })
    ).toHaveLength(elements.length);
  });

  it("sorts by text and count columns, keeping ties in source order", () => {
    const sorted = (view: ElementTableView) =>
      ids(
        getVisibleTableElements(elements, view, {
          middlewareTypeFilters: false,
        })
      );

    expect(
      sorted(withView({ sort: { key: "usedBy", direction: "desc" } }))
    ).toEqual([
      "app.resources.logger",
      "app.tasks.deleteUser",
      "app.tasks.createUser",
      "app.events.userCreated",
    ]);
    // Untitled rows tie on "" and keep their relative source order.
    expect(
      sorted(withView({ sort: { key: "title", direction: "asc" } }))
    ).toEqual([
      "app.events.userCreated",
      "app.tasks.deleteUser",
      "app.tasks.createUser",
      "app.resources.logger",
    ]);
    expect(
      sorted(withView({ sort: { key: "description", direction: "desc" } }))[0]
    ).toBe("app.tasks.createUser");
    expect(sorted(withView({ sort: { key: "id", direction: "asc" } }))[0]).toBe(
      "app.events.userCreated"
    );
  });
});

describe("sort helpers", () => {
  it("cycles a column through asc, desc, and unsorted", () => {
    const ascending = nextSortState(null, "title");
    expect(ascending).toEqual({ key: "title", direction: "asc" });
    const descending = nextSortState(ascending, "title");
    expect(descending).toEqual({ key: "title", direction: "desc" });
    expect(nextSortState(descending, "title")).toBeNull();
    expect(nextSortState(descending, "id")).toEqual({
      key: "id",
      direction: "asc",
    });
  });

  it("maps the sort to each column's aria-sort value", () => {
    const sort = { key: "id", direction: "desc" } as const;
    expect(getColumnSortState(sort, "id")).toBe("descending");
    expect(getColumnSortState({ ...sort, direction: "asc" }, "id")).toBe(
      "ascending"
    );
    expect(getColumnSortState(sort, "title")).toBe("none");
    expect(getColumnSortState(null, "id")).toBe("none");
  });

  it("walks sort buttons with wrapping arrows plus Home/End", () => {
    expect(getAdjacentSortKey("id", "ArrowRight")).toBe("title");
    expect(getAdjacentSortKey("usedBy", "ArrowRight")).toBe("id");
    expect(getAdjacentSortKey("id", "ArrowLeft")).toBe("usedBy");
    expect(getAdjacentSortKey("description", "Home")).toBe("id");
    expect(getAdjacentSortKey("title", "End")).toBe("usedBy");
    expect(getAdjacentSortKey("title", "Enter")).toBeNull();
  });
});
