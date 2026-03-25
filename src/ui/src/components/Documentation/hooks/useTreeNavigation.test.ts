/** @jest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";
import { useTreeNavigation } from "./useTreeNavigation";

describe("useTreeNavigation", () => {
  const allElements = [
    { id: "runner", type: "resource" },
    { id: "runner.logger", type: "resource" },
  ];

  const introspector = {
    getAll: () => allElements,
  } as any;

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    document.body.innerHTML = "";
  });

  it("rehydrates expanded namespace nodes from localStorage", () => {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE,
      JSON.stringify(["runner"])
    );

    const { result } = renderHook(() =>
      useTreeNavigation(allElements, "namespace", "", introspector, {
        tasks: [],
        resources: allElements,
        events: [],
        hooks: [],
        middlewares: [],
        tags: [],
      })
    );

    expect(result.current.treeNodes[0]?.id).toBe("runner");
    expect(result.current.treeNodes[0]?.isExpanded).toBe(true);
  });

  it("opens the resource hash and expands a collapsed subtree on node click", () => {
    const target = document.createElement("div");
    target.id = "element-runner";
    target.scrollIntoView = jest.fn();
    document.body.appendChild(target);

    const { result } = renderHook(() =>
      useTreeNavigation(allElements, "namespace", "", introspector, {
        tasks: [],
        resources: allElements,
        events: [],
        hooks: [],
        middlewares: [],
        tags: [],
      })
    );

    act(() => {
      result.current.handleTreeNodeClick(result.current.treeNodes[0]);
    });

    expect(window.location.hash).toBe("#element-runner");
    expect(result.current.treeNodes[0]?.isExpanded).toBe(true);
    expect(
      localStorage.getItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE
      )
    ).toBe(JSON.stringify(["runner"]));
  });

  it("collapses an already expanded mixed resource namespace node on click", () => {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE,
      JSON.stringify(["runner"])
    );
    window.location.hash = "#element-runner";

    const { result } = renderHook(() =>
      useTreeNavigation(allElements, "namespace", "", introspector, {
        tasks: [],
        resources: allElements,
        events: [],
        hooks: [],
        middlewares: [],
        tags: [],
      })
    );

    act(() => {
      result.current.handleTreeNodeClick(result.current.treeNodes[0]);
    });

    expect(result.current.treeNodes[0]?.isExpanded).toBe(false);
    expect(window.location.hash).toBe("#element-runner");
    expect(
      localStorage.getItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE
      )
    ).toBe(JSON.stringify([]));
  });

  it("navigates to the parent resource when expanded but currently focused on a child hash", () => {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE,
      JSON.stringify(["runner"])
    );
    window.location.hash = "#element-runner.logger";

    const { result } = renderHook(() =>
      useTreeNavigation(allElements, "namespace", "", introspector, {
        tasks: [],
        resources: allElements,
        events: [],
        hooks: [],
        middlewares: [],
        tags: [],
      })
    );

    act(() => {
      result.current.handleTreeNodeClick(result.current.treeNodes[0]);
    });

    expect(result.current.treeNodes[0]?.isExpanded).toBe(true);
    expect(window.location.hash).toBe("#element-runner");
    expect(
      localStorage.getItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE
      )
    ).toBe(JSON.stringify(["runner"]));
  });

  it("does not overwrite persisted expansion state while a namespace filter is active", () => {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE,
      JSON.stringify(["runner"])
    );

    const { result } = renderHook(() =>
      useTreeNavigation(allElements, "namespace", "logger", introspector, {
        tasks: [],
        resources: allElements,
        events: [],
        hooks: [],
        middlewares: [],
        tags: [],
      })
    );

    act(() => {
      result.current.handleToggleExpansion("runner", false);
    });

    expect(
      localStorage.getItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE
      )
    ).toBe(JSON.stringify(["runner"]));
  });
});
