/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TopologyGraphNode } from "../utils/topologyGraph";
import { TopologyDetailPanels } from "./TopologySidebar";

jest.mock("./TopologyNavigator", () => ({
  TopologyNavigator: () => null,
}));

function createNode(
  overrides: Partial<TopologyGraphNode> &
    Pick<TopologyGraphNode, "id" | "kind" | "label">
): TopologyGraphNode {
  return {
    id: overrides.id,
    kind: overrides.kind,
    label: overrides.label,
    subtitle: overrides.subtitle ?? overrides.id,
    description: overrides.description ?? null,
    filePath: overrides.filePath ?? null,
    icon: overrides.icon ?? "•",
    x: 0,
    y: 0,
    depth: overrides.depth ?? 0,
    order: overrides.order ?? 0,
    parentId: overrides.parentId ?? null,
    parentRelationKind: overrides.parentRelationKind ?? null,
    isFocus: overrides.isFocus ?? false,
    isVisible: overrides.isVisible ?? true,
    terminal: overrides.terminal ?? false,
    hiddenNeighborCount: 0,
    incomingCount: overrides.incomingCount ?? 0,
    outgoingCount: overrides.outgoingCount ?? 0,
    visibility: overrides.visibility ?? "public",
    pills: overrides.pills ?? [],
  };
}

describe("TopologyDetailPanels impact list", () => {
  it("groups blast nodes by direct, transitive, and contract", () => {
    const focus = createNode({
      id: "resource.cache",
      kind: "resource",
      label: "Cache",
      isFocus: true,
    });
    const nodes = [
      focus,
      createNode({
        id: "task.build",
        kind: "task",
        label: "Build",
        depth: 1,
      }),
      createNode({
        id: "event.shipped",
        kind: "event",
        label: "Shipped",
        depth: 2,
      }),
      createNode({
        id: "task.emit",
        kind: "task",
        label: "Emit",
        depth: 1,
        terminal: true,
      }),
      createNode({
        id: "task.hidden",
        kind: "task",
        label: "Hidden",
        depth: 1,
        isVisible: false,
      }),
    ];
    const onSelect = jest.fn();

    render(
      React.createElement(TopologyDetailPanels, {
        edges: [],
        nodesById: new Map(nodes.map((node) => [node.id, node] as const)),
        selectedNode: focus,
        view: "blast",
        onSelect,
      })
    );

    expect(screen.getByText("Direct (1)")).toBeTruthy();
    expect(screen.getByText("Transitive (1)")).toBeTruthy();
    expect(screen.getByText("Shared contract (1)")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();
    expect(screen.queryByText("Hidden")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Shipped/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event.shipped" })
    );
  });

  it("shows an empty state when nothing is affected", () => {
    const focus = createNode({
      id: "task.lonely",
      kind: "task",
      label: "Lonely",
      isFocus: true,
    });

    render(
      React.createElement(TopologyDetailPanels, {
        edges: [],
        nodesById: new Map([[focus.id, focus]]),
        selectedNode: focus,
        view: "blast",
        onSelect: () => {},
      })
    );

    expect(
      screen.getByText(
        "No downstream impact tracked. Mindmap shows the full neighborhood."
      )
    ).toBeTruthy();
  });

  it("hides the impact list outside the blast lens", () => {
    const focus = createNode({
      id: "resource.cache",
      kind: "resource",
      label: "Cache",
      isFocus: true,
    });
    const nodes = [
      focus,
      createNode({
        id: "task.build",
        kind: "task",
        label: "Build",
        depth: 1,
      }),
    ];

    render(
      React.createElement(TopologyDetailPanels, {
        edges: [],
        nodesById: new Map(nodes.map((node) => [node.id, node] as const)),
        selectedNode: focus,
        view: "mindmap",
        onSelect: () => {},
      })
    );

    expect(screen.queryByText("Blast radius")).toBeNull();
  });
});
