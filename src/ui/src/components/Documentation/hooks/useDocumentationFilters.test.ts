/** @jest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";
import { useDocumentationFilters } from "./useDocumentationFilters";

function createIntrospector() {
  return new Introspector({
    data: {
      tasks: [
        {
          id: "task.public",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "task.private",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: true,
          tags: [],
        },
        {
          id: "task.system",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: false,
          tags: [DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID],
        },
      ],
      hooks: [
        {
          id: "hook.public",
          events: [],
          dependsOn: [],
          emits: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "hook.private",
          events: [],
          dependsOn: [],
          emits: [],
          isPrivate: true,
          tags: [],
        },
      ],
      resources: [
        {
          id: "resource.public",
          emits: [],
          dependsOn: [],
          middleware: [],
          overrides: [],
          registers: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "resource.private",
          emits: [],
          dependsOn: [],
          middleware: [],
          overrides: [],
          registers: [],
          isPrivate: true,
          tags: [],
        },
      ],
      events: [
        {
          id: "event.public",
          listenedToBy: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "event.private",
          listenedToBy: [],
          isPrivate: true,
          tags: [],
        },
      ],
      middlewares: [
        {
          id: "middleware.public",
          type: "task",
          usedByTasks: [],
          usedByResources: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "middleware.private",
          type: "task",
          usedByTasks: [],
          usedByResources: [],
          isPrivate: true,
          tags: [],
        },
      ],
      errors: [
        {
          id: "app.errors.public",
          thrownBy: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "app.errors.private",
          thrownBy: [],
          isPrivate: true,
          tags: [],
        },
      ],
      asyncContexts: [
        {
          id: "app.asyncContexts.public",
          usedBy: [],
          requiredBy: [],
          providedBy: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "app.asyncContexts.private",
          usedBy: [],
          requiredBy: [],
          providedBy: [],
          isPrivate: true,
          tags: [],
        },
      ],
      tags: [
        {
          id: "tag.public",
          tasks: [],
          hooks: [],
          resources: [],
          taskMiddlewares: [],
          resourceMiddlewares: [],
          events: [],
          errors: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "tag.private",
          tasks: [],
          hooks: [],
          resources: [],
          taskMiddlewares: [],
          resourceMiddlewares: [],
          events: [],
          errors: [],
          isPrivate: true,
          tags: [],
        },
      ],
    },
  });
}

describe("useDocumentationFilters", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults private visibility to ON and includes private non-system items", () => {
    const introspector = createIntrospector();
    const { result } = renderHook(() => useDocumentationFilters(introspector));

    const taskIds = result.current.tasks.map((task) => task.id);
    expect(taskIds).toEqual(["task.public", "task.private"]);
    expect(taskIds).not.toContain("task.system");
  });

  it("filters private elements across all element types when PRIVATE is OFF", () => {
    const introspector = createIntrospector();
    const { result } = renderHook(() => useDocumentationFilters(introspector));

    act(() => {
      result.current.handleShowSystemChange(true);
      result.current.handleShowPrivateChange(false);
    });

    expect(result.current.tasks.map((item) => item.id)).toEqual([
      "task.public",
      "task.system",
    ]);
    expect(result.current.resources.map((item) => item.id)).toEqual([
      "resource.public",
    ]);
    expect(result.current.events.map((item) => item.id)).toEqual([
      "event.public",
    ]);
    expect(result.current.hooks.map((item) => item.id)).toEqual([
      "hook.public",
    ]);
    expect(result.current.middlewares.map((item) => item.id)).toEqual([
      "middleware.public",
    ]);
    expect(result.current.errors.map((item) => item.id)).toEqual([
      "app.errors.public",
    ]);
    expect(result.current.asyncContexts.map((item) => item.id)).toEqual([
      "app.asyncContexts.public",
    ]);
    expect(result.current.tags.map((item) => item.id)).toEqual(["tag.public"]);
  });

  it("matches errors and async contexts by suffix when searching with a global id fragment", () => {
    const introspector = createIntrospector();
    const { result } = renderHook(() => useDocumentationFilters(introspector));

    act(() => {
      result.current.setLocalNamespaceSearch("public");
    });

    expect(result.current.errors.map((item) => item.id)).toEqual([
      "app.errors.public",
    ]);
    expect(result.current.asyncContexts.map((item) => item.id)).toEqual([
      "app.asyncContexts.public",
    ]);
    expect(result.current.allElements.map((item) => item.id)).toContain(
      "app.errors.public"
    );
    expect(result.current.allElements.map((item) => item.id)).toContain(
      "app.asyncContexts.public"
    );
  });

  it("respects persisted PRIVATE preference from localStorage", () => {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE,
      "0"
    );

    const introspector = createIntrospector();
    const { result } = renderHook(() => useDocumentationFilters(introspector));

    expect(result.current.showPrivate).toBe(false);
    expect(result.current.tasks.map((task) => task.id)).toEqual([
      "task.public",
    ]);
  });

  it("persists toggle changes and reset restores PRIVATE to ON", () => {
    const introspector = createIntrospector();
    const { result } = renderHook(() => useDocumentationFilters(introspector));

    act(() => {
      result.current.handleShowPrivateChange(false);
    });

    expect(
      localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE)
    ).toBe("0");
    expect(result.current.showPrivate).toBe(false);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.showPrivate).toBe(true);
    expect(
      localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE)
    ).toBe("1");
  });
});
