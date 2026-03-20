/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import type {
  TopologyGraphNode,
  TopologyGraphProjection,
} from "../utils/topologyGraph";
import { TopologyPanelView } from "./TopologyPanelView";

const mockSidebar = jest.fn(() => "sidebar");
const mockDetailPanels = jest.fn(() => "detail-panels");

jest.mock("./TopologyCanvas", () => ({
  TopologyCanvas: () => "canvas",
}));

jest.mock("./TopologyFocusBar", () => ({
  TopologyFocusBar: () => "focus-bar",
}));

jest.mock("./TopologyToolbar", () => ({
  TopologyToolbar: () => "toolbar",
}));

jest.mock("./TopologySidebar", () => ({
  TopologySidebar: (props: unknown) => mockSidebar(props),
  TopologyDetailPanels: (props: unknown) => mockDetailPanels(props),
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
    icon: overrides.icon ?? "•",
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

function createProjection(nodes: TopologyGraphNode[]): TopologyGraphProjection {
  return {
    focus: { kind: "resource", id: nodes[0]?.id ?? "resource.root" },
    view: "mindmap",
    radius: 2,
    nodes,
    edges: [],
    selectedNode: nodes[0],
    hiddenNodeCount: 0,
    summary: {
      visibleNodes: nodes.length,
      visibleEdges: 0,
      hiddenNodes: 0,
    },
  };
}

describe("TopologyPanelView", () => {
  beforeEach(() => {
    mockSidebar.mockClear();
    mockDetailPanels.mockClear();
  });

  it("keeps a floating reopen handle visible when the navigator is collapsed", () => {
    const nodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        label: "Root",
        incomingCount: 1,
        outgoingCount: 2,
        isFocus: true,
      }),
    ];
    const graph = createProjection(nodes);

    const { container } = render(
      React.createElement(TopologyPanelView, {
        graph,
        nodeMap: new Map(nodes.map((node) => [node.id, node] as const)),
        selectedNode: nodes[0],
        view: "mindmap",
        autoOrder: true,
        isNavigatorOpen: false,
        navigatorQuery: "",
        isFullscreen: false,
        canOpenSelectedCard: true,
        onSelectNode: () => {},
        onNavigatorQueryChange: () => {},
        onViewChange: () => {},
        onRadiusChange: () => {},
        onReset: () => {},
        onOpenSelectedCard: () => {},
        onToggleFullscreen: () => {},
        onToggleAutoOrder: () => {},
        onToggleNavigator: () => {},
      })
    );

    expect(mockSidebar).not.toHaveBeenCalled();
    expect(mockDetailPanels).toHaveBeenCalled();
    expect(
      container.querySelector(".topology-panel__layout")?.className
    ).toContain("topology-panel__layout--navigator-closed");
    expect(screen.queryByText("sidebar")).toBeNull();
    expect(container.textContent).toContain("detail-panels");
    expect(
      screen.getByRole("button", { name: "Expand navigator drawer" })
    ).toBeTruthy();
  });

  it("renders the sidebar in its own layout column when the navigator is expanded", () => {
    const nodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        label: "Root",
        incomingCount: 1,
        outgoingCount: 2,
        isFocus: true,
      }),
    ];
    const graph = createProjection(nodes);

    const { container } = render(
      React.createElement(TopologyPanelView, {
        graph,
        nodeMap: new Map(nodes.map((node) => [node.id, node] as const)),
        selectedNode: nodes[0],
        view: "mindmap",
        autoOrder: true,
        isNavigatorOpen: true,
        navigatorQuery: "",
        isFullscreen: false,
        canOpenSelectedCard: true,
        onSelectNode: () => {},
        onNavigatorQueryChange: () => {},
        onViewChange: () => {},
        onRadiusChange: () => {},
        onReset: () => {},
        onOpenSelectedCard: () => {},
        onToggleFullscreen: () => {},
        onToggleAutoOrder: () => {},
        onToggleNavigator: () => {},
      })
    );

    expect(mockSidebar).toHaveBeenCalled();
    expect(mockDetailPanels).toHaveBeenCalled();
    expect(
      container.querySelector(".topology-panel__layout")?.className
    ).toContain("topology-panel__layout--navigator-open");
    expect(container.textContent).toContain("detail-panels");
    expect(
      screen.queryByRole("button", { name: "Expand navigator drawer" })
    ).toBeNull();
  });
});
