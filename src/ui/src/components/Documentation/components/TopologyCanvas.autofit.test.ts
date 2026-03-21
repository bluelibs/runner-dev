/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import type {
  TopologyGraphNode,
  TopologyGraphProjection,
} from "../utils/topologyGraph";
import { TopologyCanvas } from "./TopologyCanvas";

jest.mock("marked", () => {
  class RendererMock {}

  return {
    __esModule: true,
    Renderer: RendererMock,
    lexer: jest.fn((content: string) => [
      {
        type: "paragraph",
        raw: content,
      },
    ]),
    parse: jest.fn((content: string) => content),
    setOptions: jest.fn(),
  };
});

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
    focus: {
      kind: "resource",
      id: nodes[0]?.id ?? "resource.focus",
    },
    view: "mindmap",
    radius: 3,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `edge.${index}`,
      sourceId: nodes[0]?.id ?? node.id,
      targetId: node.id,
      kind: "used-by",
      isPrimary: true,
      isCrossLink: false,
    })),
    selectedNode: nodes[0],
    hiddenNodeCount: 0,
    summary: {
      visibleNodes: nodes.length,
      visibleEdges: Math.max(0, nodes.length - 1),
      hiddenNodes: 0,
    },
  };
}

function getCanvasStage(): HTMLElement | null {
  return document.querySelector(
    '[id^="topology-canvas-stage-"]'
  ) as HTMLElement | null;
}

describe("TopologyCanvas autofit", () => {
  const originalResizeObserver = global.ResizeObserver;
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    global.ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = jest.fn(function mockRect() {
      const element = this as HTMLElement;
      if (element.classList.contains("topology-panel__canvas-shell")) {
        return {
          width: 1200,
          height: 900,
          top: 0,
          left: 0,
          right: 1200,
          bottom: 900,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }

      if (element.classList.contains("topology-panel__scroll-rail")) {
        return {
          width: 56,
          height: 724,
          top: 92,
          left: 20,
          right: 76,
          bottom: 816,
          x: 20,
          y: 92,
          toJSON: () => ({}),
        };
      }

      return {
        width: 120,
        height: 48,
        top: 0,
        left: 0,
        right: 120,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("auto-fits centered three-node layouts without shrinking them toward the origin", async () => {
    render(
      React.createElement(TopologyCanvas, {
        graph: createProjection([
          createNode({
            id: "resource.centered",
            kind: "resource",
            label: "Centered Root",
            x: 500,
            y: 500,
            incomingCount: 1,
            outgoingCount: 2,
            isFocus: true,
          }),
          createNode({
            id: "resource.centered.left",
            kind: "resource",
            label: "Left",
            x: 335,
            y: 500,
            incomingCount: 1,
            outgoingCount: 1,
          }),
          createNode({
            id: "resource.centered.bottom",
            kind: "resource",
            label: "Bottom",
            x: 500,
            y: 720,
            incomingCount: 1,
            outgoingCount: 1,
          }),
        ]),
        selectedNodeId: "resource.centered",
        isFullscreen: false,
        onSelectNode: () => {},
        onToggleFullscreen: () => {},
      })
    );

    const stage = getCanvasStage();
    const rail = await screen.findByRole("scrollbar", {
      name: "Topology vertical navigator",
    });

    await waitFor(() => {
      expect(stage?.style.transform).toContain("scale(");
    });

    const transform = stage?.style.transform ?? "";
    const match = transform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/
    );

    expect(match).toBeTruthy();
    expect(Number(match?.[1] ?? 0)).toBeGreaterThan(180);
    expect(Number(match?.[2] ?? 0)).toBeGreaterThanOrEqual(92);
    expect(Number(match?.[3] ?? 0)).toBeGreaterThan(1.2);
    expect(rail.getAttribute("aria-disabled")).toBe("true");
  });
});
