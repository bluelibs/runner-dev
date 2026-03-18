/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  TopologyGraphNode,
  TopologyGraphProjection,
} from "../utils/topologyGraph";
import { TopologyCanvas } from "./TopologyCanvas";

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

describe("TopologyCanvas", () => {
  const originalResizeObserver = global.ResizeObserver;
  const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture;
  const originalReleasePointerCapture =
    HTMLElement.prototype.releasePointerCapture;
  const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture;
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
    HTMLElement.prototype.setPointerCapture = jest.fn();
    HTMLElement.prototype.releasePointerCapture = jest.fn();
    HTMLElement.prototype.hasPointerCapture = jest.fn(() => true);
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
    HTMLElement.prototype.setPointerCapture = originalSetPointerCapture;
    HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture;
    HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("renders the rail inside the canvas and keeps it available in fullscreen", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "runner.http.server",
            kind: "resource",
            label: "HTTP Server",
            x: 100,
            y: 120,
            incomingCount: 2,
            outgoingCount: 3,
            isFocus: true,
          }),
          createNode({
            id: "runner.task.listen",
            kind: "task",
            label: "Listen",
            x: 420,
            y: 1820,
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ])}
        selectedNodeId="runner.http.server"
        isFullscreen
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const rail = await screen.findByRole("scrollbar", {
      name: "Topology vertical navigator",
    });
    expect(rail).toBeTruthy();
    expect(rail.className).toContain("topology-panel__scroll-rail");
  });

  it("clicking or dragging the rail moves the viewport without changing horizontal pan", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "runner.logger",
            kind: "resource",
            label: "Logger",
            x: 180,
            y: 160,
            incomingCount: 4,
            outgoingCount: 4,
            isFocus: true,
          }),
          createNode({
            id: "task.audit",
            kind: "task",
            label: "Audit",
            x: 620,
            y: 2280,
            incomingCount: 2,
            outgoingCount: 1,
          }),
        ])}
        selectedNodeId="runner.logger"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const stage = getCanvasStage();
    const rail = await screen.findByRole("scrollbar", {
      name: "Topology vertical navigator",
    });
    expect(stage).toBeTruthy();
    expect(stage?.id).toMatch(/^topology-canvas-stage-/);

    await waitFor(() => {
      expect(stage?.style.transform).toContain("translate(");
    });

    const initialTransform = stage?.style.transform ?? "";
    const initialMatch = initialTransform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\)/
    );
    expect(initialMatch).toBeTruthy();

    fireEvent.pointerDown(rail, {
      pointerId: 7,
      clientY: 700,
    });
    fireEvent.pointerUp(rail, {
      pointerId: 7,
      clientY: 700,
    });

    let clickedTransform = "";
    let clickedMatch: RegExpMatchArray | null = null;
    await waitFor(() => {
      expect(stage?.style.transform).not.toBe(initialTransform);
      clickedTransform = stage?.style.transform ?? "";
      clickedMatch = clickedTransform.match(
        /translate\(([-\d.]+)px, ([-\d.]+)px\)/
      );
      expect(clickedMatch).toBeTruthy();
    });

    expect(clickedMatch?.[1]).toBe(initialMatch?.[1]);
    expect(Number(clickedMatch?.[2] ?? 0)).toBeLessThan(
      Number(initialMatch?.[2] ?? 0)
    );

    const thumb = rail.querySelector(
      "[data-topology-rail-thumb='true']"
    ) as HTMLElement;

    fireEvent.pointerDown(thumb, {
      pointerId: 8,
      clientY: 620,
    });
    fireEvent.pointerMove(rail, {
      pointerId: 8,
      clientY: 240,
    });
    fireEvent.pointerUp(rail, {
      pointerId: 8,
      clientY: 240,
    });

    await waitFor(() => {
      const draggedTransform = stage?.style.transform ?? "";
      const draggedMatch = draggedTransform.match(
        /translate\(([-\d.]+)px, ([-\d.]+)px\)/
      );
      expect(draggedMatch?.[1]).toBe(initialMatch?.[1]);
      expect(Number(draggedMatch?.[2] ?? 0)).toBeGreaterThan(
        Number(clickedMatch?.[2] ?? 0)
      );
    });
  });

  it("keeps node dragging working while the rail is present", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.focus",
            kind: "resource",
            label: "Focus",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.drag.me",
            kind: "task",
            label: "Drag Me",
            x: 420,
            y: 1640,
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ])}
        selectedNodeId="resource.focus"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const node = await screen.findByRole("button", {
      name: /Drag Me/i,
    });
    const stage = getCanvasStage();

    await waitFor(() => {
      expect(stage?.style.transform).toContain("translate(");
      expect(stage?.style.transform).not.toContain("NaN");
    });

    const beforeStyle = node.getAttribute("style") ?? "";

    fireEvent.pointerDown(node, {
      pointerId: 12,
      clientX: 200,
      clientY: 200,
    });
    fireEvent.pointerMove(node.parentElement as HTMLElement, {
      pointerId: 12,
      clientX: 260,
      clientY: 320,
    });
    fireEvent.pointerUp(node.parentElement as HTMLElement, {
      pointerId: 12,
      clientX: 260,
      clientY: 320,
    });

    await waitFor(() => {
      expect(node.getAttribute("style")).not.toBe(beforeStyle);
    });
  });

  it("selects a node when activated by click", async () => {
    const onSelectNode = jest.fn();

    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.focus",
            kind: "resource",
            label: "Focus",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.click.me",
            kind: "task",
            label: "Click Me",
            x: 420,
            y: 1640,
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ])}
        selectedNodeId="resource.focus"
        isFullscreen={false}
        onSelectNode={onSelectNode}
        onToggleFullscreen={() => {}}
      />
    );

    const node = await screen.findByRole("button", {
      name: /Click Me/i,
    });

    fireEvent.click(node);

    expect(onSelectNode).toHaveBeenCalledTimes(1);
    expect(onSelectNode.mock.calls[0]?.[0].id).toBe("task.click.me");
  });

  it("pans the graph when dragging empty canvas space", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.pan",
            kind: "resource",
            label: "Pan Root",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.pan.child",
            kind: "task",
            label: "Pan Child",
            x: 620,
            y: 2280,
            incomingCount: 2,
            outgoingCount: 1,
          }),
        ])}
        selectedNodeId="resource.pan"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const shell = document.querySelector(
      ".topology-panel__canvas-shell"
    ) as HTMLElement;
    const background = document.querySelector(
      ".topology-panel__canvas-background"
    ) as HTMLElement;
    const stage = getCanvasStage();

    await waitFor(() => {
      expect(stage?.style.transform).toContain("translate(");
    });

    const initialTransform = stage?.style.transform ?? "";
    const initialMatch = initialTransform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\)/
    );
    expect(initialMatch).toBeTruthy();

    fireEvent.pointerDown(background, {
      pointerId: 14,
      button: 0,
      clientX: 720,
      clientY: 420,
    });
    fireEvent.pointerMove(shell, {
      pointerId: 14,
      clientX: 660,
      clientY: 360,
    });

    await waitFor(() => {
      expect(shell.className).toContain(
        "topology-panel__canvas-shell--panning"
      );
      expect(stage?.style.transform).not.toBe(initialTransform);
    });

    fireEvent.pointerUp(shell, {
      pointerId: 14,
      clientX: 660,
      clientY: 360,
    });

    const draggedTransform = stage?.style.transform ?? "";
    const draggedMatch = draggedTransform.match(
      /translate\(([-\d.]+)px, ([-\d.]+)px\)/
    );
    expect(Number(draggedMatch?.[1] ?? 0)).toBeLessThan(
      Number(initialMatch?.[1] ?? 0)
    );
    expect(Number(draggedMatch?.[2] ?? 0)).toBeLessThan(
      Number(initialMatch?.[2] ?? 0)
    );
    expect(shell.className).not.toContain(
      "topology-panel__canvas-shell--panning"
    );
  });

  it("ignores plain wheel scrolling and only zooms on modified gestures", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.zoom",
            kind: "resource",
            label: "Zoom",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.zoom.child",
            kind: "task",
            label: "Zoom Child",
            x: 620,
            y: 2280,
            incomingCount: 2,
            outgoingCount: 1,
          }),
        ])}
        selectedNodeId="resource.zoom"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const shell = document.querySelector(
      ".topology-panel__canvas-shell"
    ) as HTMLElement;
    const stage = getCanvasStage();

    await waitFor(() => {
      expect(stage?.style.transform).toContain("scale(");
    });

    const initialTransform = stage?.style.transform ?? "";

    fireEvent.wheel(shell, {
      deltaY: -80,
    });

    expect(stage?.style.transform).toBe(initialTransform);

    fireEvent.wheel(shell, {
      deltaY: -80,
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(stage?.style.transform).not.toBe(initialTransform);
    });
  });

  it("shows a disabled rail when the graph fits vertically", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.compact",
            kind: "resource",
            label: "Compact",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.nearby",
            kind: "task",
            label: "Nearby",
            x: 420,
            y: 360,
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ])}
        selectedNodeId="resource.compact"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const rail = await screen.findByRole("scrollbar", {
      name: "Topology vertical navigator",
    });

    expect(rail.getAttribute("aria-disabled")).toBe("true");
    expect(rail.getAttribute("tabindex")).toBe("-1");
    expect(rail.className).toContain("topology-panel__scroll-rail--disabled");
  });

  it("auto-fits compact graphs instead of leaving them far off-screen", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.small",
            kind: "resource",
            label: "Small Root",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 2,
            isFocus: true,
          }),
          createNode({
            id: "resource.small.left",
            kind: "resource",
            label: "Left",
            x: 20,
            y: 320,
            incomingCount: 1,
            outgoingCount: 1,
          }),
          createNode({
            id: "resource.small.right",
            kind: "resource",
            label: "Right",
            x: 340,
            y: 320,
            incomingCount: 1,
            outgoingCount: 1,
          }),
          createNode({
            id: "resource.small.bottom",
            kind: "resource",
            label: "Bottom",
            x: 180,
            y: 500,
            incomingCount: 1,
            outgoingCount: 1,
          }),
        ])}
        selectedNodeId="resource.small"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
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
    expect(Number(match?.[1] ?? 0)).toBeGreaterThan(116);
    expect(Number(match?.[2] ?? 0)).toBeGreaterThanOrEqual(92);
    expect(Number(match?.[3] ?? 0)).toBeGreaterThan(1);
    expect(rail.getAttribute("aria-disabled")).toBe("true");
  });

  it("refits the viewport when using the fit control after manual pan", async () => {
    render(
      <TopologyCanvas
        graph={createProjection([
          createNode({
            id: "resource.fit",
            kind: "resource",
            label: "Fit Root",
            x: 180,
            y: 160,
            incomingCount: 1,
            outgoingCount: 1,
            isFocus: true,
          }),
          createNode({
            id: "task.fit.child",
            kind: "task",
            label: "Fit Child",
            x: 420,
            y: 1640,
            incomingCount: 1,
            outgoingCount: 2,
          }),
        ])}
        selectedNodeId="resource.fit"
        isFullscreen={false}
        onSelectNode={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    const shell = document.querySelector(
      ".topology-panel__canvas-shell"
    ) as HTMLElement;
    const background = document.querySelector(
      ".topology-panel__canvas-background"
    ) as HTMLElement;
    const stage = getCanvasStage();
    const fitButton = await screen.findByRole("button", {
      name: "Reset zoom and pan",
    });

    await waitFor(() => {
      expect(stage?.style.transform).toContain("translate(");
    });

    const initialTransform = stage?.style.transform ?? "";

    fireEvent.pointerDown(background, {
      pointerId: 19,
      button: 0,
      clientX: 720,
      clientY: 420,
    });
    fireEvent.pointerMove(shell, {
      pointerId: 19,
      clientX: 620,
      clientY: 320,
    });
    fireEvent.pointerUp(shell, {
      pointerId: 19,
      clientX: 620,
      clientY: 320,
    });

    await waitFor(() => {
      expect(stage?.style.transform).not.toBe(initialTransform);
    });

    fireEvent.click(fitButton);

    await waitFor(() => {
      expect(stage?.style.transform).toBe(initialTransform);
    });
  });
});
