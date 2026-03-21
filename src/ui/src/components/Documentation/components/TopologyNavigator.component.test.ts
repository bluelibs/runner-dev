/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TopologyGraphNode } from "../utils/topologyGraph";
import { TopologyNavigator } from "./TopologyNavigator";

jest.mock("../utils/markdownUtils", () => ({
  MarkdownRenderer: ({ content }: { content: string }) =>
    React.createElement("div", null, content),
}));

function createNode(
  overrides: Partial<TopologyGraphNode> &
    Pick<
      TopologyGraphNode,
      "id" | "kind" | "label" | "incomingCount" | "outgoingCount"
    >
): TopologyGraphNode {
  return {
    id: overrides.id,
    kind: overrides.kind,
    label: overrides.label,
    subtitle: overrides.subtitle ?? overrides.id,
    description: overrides.description ?? null,
    filePath: overrides.filePath ?? null,
    icon: overrides.icon ?? "◦",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    depth: overrides.depth ?? 0,
    order: overrides.order ?? 0,
    parentId: overrides.parentId ?? null,
    parentRelationKind: overrides.parentRelationKind ?? null,
    isFocus: overrides.isFocus ?? false,
    isVisible: overrides.isVisible ?? true,
    hiddenNeighborCount: overrides.hiddenNeighborCount ?? 0,
    incomingCount: overrides.incomingCount,
    outgoingCount: overrides.outgoingCount,
    visibility: overrides.visibility ?? "public",
    pills: overrides.pills ?? [],
  };
}

describe("TopologyNavigator component", () => {
  it("keeps long navigator rows inside a dedicated content column", () => {
    const { container } = render(
      React.createElement(TopologyNavigator, {
        nodes: [
          createNode({
            id: "enhanced-superapp.dev.server.http.extremely.long.identifier",
            kind: "resource",
            label: "HTTP Server With A Remarkably Long Title",
            incomingCount: 8,
            outgoingCount: 9,
            hiddenNeighborCount: 2,
          }),
        ],
        selectedNodeId:
          "enhanced-superapp.dev.server.http.extremely.long.identifier",
        query: "",
        onQueryChange: () => {},
        onCollapse: () => {},
        onSelect: () => {},
      })
    );

    const item = container.querySelector(".topology-panel__navigator-item");
    const icon = container.querySelector(
      ".topology-panel__navigator-item-icon"
    );
    const content = container.querySelector(
      ".topology-panel__navigator-item-content"
    );
    const subtitle = container.querySelector(
      ".topology-panel__navigator-item-subtitle"
    );

    expect(item).toBeTruthy();
    expect(icon).toBeTruthy();
    expect(content).toBeTruthy();
    expect(subtitle?.textContent).toContain("enhanced-superapp");
    expect(subtitle?.textContent).toContain("extremely");
    expect(subtitle?.textContent).toContain("identifier");
  });

  it("renders description toggles only for nodes with descriptions", () => {
    render(
      React.createElement(TopologyNavigator, {
        nodes: [
          createNode({
            id: "task.alpha",
            kind: "task",
            label: "Alpha Task",
            description: "Helpful **markdown** note",
            incomingCount: 1,
            outgoingCount: 2,
          }),
          createNode({
            id: "task.beta",
            kind: "task",
            label: "Beta Task",
            incomingCount: 1,
            outgoingCount: 1,
          }),
        ],
        selectedNodeId: "task.alpha",
        query: "",
        onQueryChange: () => {},
        onCollapse: () => {},
        onSelect: () => {},
      })
    );

    expect(
      screen.getByRole("button", { name: "Alpha Task description" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Beta Task description" })
    ).toBeNull();
  });

  it("toggles inline descriptions without selecting the navigator row", () => {
    const onSelect = jest.fn();

    render(
      React.createElement(TopologyNavigator, {
        nodes: [
          createNode({
            id: "task.alpha",
            kind: "task",
            label: "Alpha Task",
            description: "Helpful **markdown** note",
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ],
        selectedNodeId: "task.alpha",
        query: "",
        onQueryChange: () => {},
        onCollapse: () => {},
        onSelect,
      })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Alpha Task description" })
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Helpful **markdown** note")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Alpha Task description" })
    );

    expect(screen.queryByText("Helpful **markdown** note")).toBeNull();

    fireEvent.click(screen.getByText("Alpha Task"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0].id).toBe("task.alpha");
  });
});
