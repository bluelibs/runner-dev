/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NavigationView } from "./NavigationView";
import type { TreeNode } from "../utils/tree-utils";

describe("NavigationView", () => {
  function renderNamespaceElementNode() {
    const onNodeClick = jest.fn();
    const onToggleExpansion = jest.fn();
    const namespaceNode: TreeNode = {
      id: "runner",
      label: "runner",
      type: "folder",
      icon: "🧱",
      children: [
        {
          id: "runner.logger",
          label: "logger",
          type: "resource",
          icon: "🧱",
          children: [],
          elementId: "runner.logger",
          element: { id: "runner.logger", type: "resource" },
          isExpanded: false,
        },
      ],
      folderType: "resource",
      elementId: "runner",
      element: { id: "runner", type: "resource" },
      isExpanded: false,
    };

    const view = render(
      React.createElement(NavigationView, {
        mode: "tree",
        treeType: "namespace",
        nodes: [namespaceNode],
        sections: [],
        onNodeClick,
        onToggleExpansion,
      })
    );

    return { ...view, onNodeClick, onToggleExpansion };
  }

  test("keeps namespace element nodes clickable even when they also have children", () => {
    const { onNodeClick, onToggleExpansion } = renderNamespaceElementNode();

    fireEvent.click(screen.getByText("runner"));

    expect(onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "runner", elementId: "runner" })
    );
    expect(onToggleExpansion).not.toHaveBeenCalled();
  });

  test("keeps the expander available for namespace element nodes with children", () => {
    const { container, onNodeClick, onToggleExpansion } =
      renderNamespaceElementNode();

    const expander = container.querySelector(".nav-expander");
    expect(expander).toBeTruthy();

    fireEvent.click(expander!);

    expect(onToggleExpansion).toHaveBeenCalledWith("runner");
    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
