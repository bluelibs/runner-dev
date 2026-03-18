import React from "react";
import { formatId } from "../utils/formatting";
import type {
  TopologyGraphNode,
  TopologyGraphProjection,
} from "../utils/topologyGraph";
import {
  clampTopologyScale,
  getInitialTopologyViewport,
  getTopologyCanvasBounds,
  getZoomedViewport,
  type TopologyViewportState,
} from "./topologyCanvas.utils";
import { buildEdgePath } from "./topologyPanel.utils";
import { TopologyScrollRail } from "./TopologyScrollRail";
import {
  clampViewportToBounds,
  getFittedViewport,
  getViewportMetrics,
  setViewportPositionY,
  TOPOLOGY_CANVAS_INSETS,
  type TopologyCanvasSize,
} from "./topologyViewport.utils";

export interface TopologyCanvasProps {
  graph: TopologyGraphProjection;
  selectedNodeId: string;
  isFullscreen: boolean;
  onSelectNode: (node: TopologyGraphNode) => void;
  onToggleFullscreen: () => void;
}

type CanvasPointerState =
  | {
      pointerId: number;
      type: "node";
      nodeId: string;
      startedAtX: number;
      startedAtY: number;
      moved: boolean;
      initialNodeX: number;
      initialNodeY: number;
    }
  | {
      pointerId: number;
      type: "canvas";
      startedAtX: number;
      startedAtY: number;
      moved: boolean;
      initialOffsetX: number;
      initialOffsetY: number;
    };

const DRAG_CLICK_THRESHOLD = 8;
const DEFAULT_CANVAS_SIZE: TopologyCanvasSize = {
  width: 1280,
  height: 820,
};

function clampViewport(
  bounds: ReturnType<typeof getTopologyCanvasBounds>,
  canvasSize: TopologyCanvasSize,
  viewport: TopologyViewportState
) {
  return clampViewportToBounds(
    bounds,
    viewport,
    canvasSize,
    TOPOLOGY_CANVAS_INSETS
  );
}

function shouldStartCanvasPan(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !target.closest(".topology-panel__node") &&
    !target.closest(".topology-panel__canvas-controls") &&
    !target.closest(".topology-panel__scroll-rail")
  );
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  graph,
  selectedNodeId,
  isFullscreen,
  onSelectNode,
  onToggleFullscreen,
}) => {
  const shellRef = React.useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] =
    React.useState<TopologyCanvasSize>(DEFAULT_CANVAS_SIZE);
  const pointerStateRef = React.useRef<CanvasPointerState | null>(null);
  const viewportModeRef = React.useRef<"fit" | "manual">("fit");

  const [viewport, setViewport] = React.useState(() =>
    getInitialTopologyViewport(isFullscreen)
  );
  const [draggedPositions, setDraggedPositions] = React.useState<
    Record<string, { x: number; y: number }>
  >({});
  const [isPanning, setIsPanning] = React.useState(false);

  React.useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const measureCanvas = () => {
      const rect = shell.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setCanvasSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : {
              width: rect.width,
              height: rect.height,
            }
      );
    };

    measureCanvas();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureCanvas);
      return () => window.removeEventListener("resize", measureCanvas);
    }

    const observer = new ResizeObserver(() => {
      measureCanvas();
    });
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    setDraggedPositions({});
    viewportModeRef.current = "fit";
  }, [graph.focus.id, graph.radius, graph.view, isFullscreen]);

  React.useEffect(() => {
    setDraggedPositions((current) => {
      const nextEntries = Object.entries(current).filter(([id]) =>
        graph.nodes.some((node) => node.id === id)
      );
      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });
  }, [graph.nodes]);

  const bounds = React.useMemo(
    () => getTopologyCanvasBounds(graph.nodes, draggedPositions),
    [draggedPositions, graph.nodes]
  );

  React.useEffect(() => {
    if (viewportModeRef.current === "fit") {
      setViewport(
        getFittedViewport(bounds, canvasSize, TOPOLOGY_CANVAS_INSETS)
      );
      return;
    }

    setViewport((current) => clampViewport(bounds, canvasSize, current));
  }, [bounds, canvasSize]);

  const positionedNodes = React.useMemo(
    () =>
      graph.nodes.map((node) => {
        const position = draggedPositions[node.id] ?? node;
        return {
          ...node,
          x: position.x,
          y: position.y,
        };
      }),
    [draggedPositions, graph.nodes]
  );

  const positionedNodeMap = React.useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node] as const)),
    [positionedNodes]
  );

  const viewportMetrics = React.useMemo(
    () =>
      getViewportMetrics(bounds, viewport, canvasSize, TOPOLOGY_CANVAS_INSETS),
    [bounds, canvasSize, viewport]
  );

  const updateViewport = React.useCallback(
    (updater: (current: TopologyViewportState) => TopologyViewportState) => {
      viewportModeRef.current = "manual";
      setViewport((current) =>
        clampViewport(bounds, canvasSize, updater(current))
      );
    },
    [bounds, canvasSize]
  );

  const resetView = React.useCallback(() => {
    viewportModeRef.current = "fit";
    setViewport(getFittedViewport(bounds, canvasSize, TOPOLOGY_CANVAS_INSETS));
  }, [bounds, canvasSize]);

  const resetNodePositions = React.useCallback(() => {
    setDraggedPositions({});
  }, []);

  const updateZoom = React.useCallback(
    (factor: number) => {
      updateViewport((current) => getZoomedViewport(current, factor));
    },
    [updateViewport]
  );

  const updateViewportPositionY = React.useCallback(
    (positionY: number) => {
      updateViewport((current) =>
        setViewportPositionY(
          bounds,
          current,
          canvasSize,
          positionY,
          TOPOLOGY_CANVAS_INSETS
        )
      );
    },
    [bounds, canvasSize, updateViewport]
  );

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const isModifiedZoomGesture = event.ctrlKey || event.metaKey;
      if (!isModifiedZoomGesture) {
        return;
      }
      event.preventDefault();

      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      updateViewport((current) => ({
        ...current,
        scale: clampTopologyScale(current.scale * factor),
      }));
    },
    [updateViewport]
  );

  const releasePointer = React.useCallback((pointerId: number) => {
    if (shellRef.current?.hasPointerCapture(pointerId)) {
      shellRef.current.releasePointerCapture(pointerId);
    }
    pointerStateRef.current = null;
    setIsPanning(false);
  }, []);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - pointerState.startedAtX;
      const deltaY = event.clientY - pointerState.startedAtY;
      if (
        !pointerState.moved &&
        Math.hypot(deltaX, deltaY) > DRAG_CLICK_THRESHOLD
      ) {
        pointerState.moved = true;
      }

      if (pointerState.type === "canvas") {
        setIsPanning(pointerState.moved);
        updateViewport(() => ({
          scale: viewport.scale,
          offsetX: pointerState.initialOffsetX + deltaX,
          offsetY: pointerState.initialOffsetY + deltaY,
        }));
        return;
      }

      const draggedNode = positionedNodeMap.get(pointerState.nodeId);
      if (!draggedNode) return;

      const scale = viewport.scale || 1;
      setDraggedPositions((current) => ({
        ...current,
        [pointerState.nodeId]: {
          x: pointerState.initialNodeX + deltaX / scale,
          y: pointerState.initialNodeY + deltaY / scale,
        },
      }));
    },
    [positionedNodeMap, updateViewport, viewport.scale]
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;

      const shouldSelect = pointerState.type === "node" && !pointerState.moved;
      const selectedNode = shouldSelect
        ? positionedNodeMap.get(pointerState.nodeId)
        : null;
      releasePointer(event.pointerId);
      if (selectedNode) {
        onSelectNode(selectedNode);
      }
    },
    [onSelectNode, positionedNodeMap, releasePointer]
  );

  const beginNodeDrag = React.useCallback(
    (node: TopologyGraphNode) =>
      (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        pointerStateRef.current = {
          pointerId: event.pointerId,
          type: "node",
          nodeId: node.id,
          startedAtX: event.clientX,
          startedAtY: event.clientY,
          moved: false,
          initialNodeX: positionedNodeMap.get(node.id)?.x ?? node.x,
          initialNodeY: positionedNodeMap.get(node.id)?.y ?? node.y,
        };
        shellRef.current?.setPointerCapture(event.pointerId);
      },
    [positionedNodeMap]
  );

  const beginCanvasPan = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (!shouldStartCanvasPan(event.target)) return;

      event.preventDefault();
      pointerStateRef.current = {
        pointerId: event.pointerId,
        type: "canvas",
        startedAtX: event.clientX,
        startedAtY: event.clientY,
        moved: false,
        initialOffsetX: viewport.offsetX,
        initialOffsetY: viewport.offsetY,
      };
      shellRef.current?.setPointerCapture(event.pointerId);
    },
    [viewport.offsetX, viewport.offsetY]
  );

  return (
    <div
      ref={shellRef}
      className={[
        "topology-panel__canvas-shell",
        isPanning ? "topology-panel__canvas-shell--panning" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onWheel={handleWheel}
      onPointerDown={beginCanvasPan}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="topology-panel__canvas-background" />

      <div className="topology-panel__canvas-controls">
        <div className="topology-panel__canvas-pill">
          {positionedNodes.length} nodes
        </div>
        <div className="topology-panel__canvas-actions">
          <button
            type="button"
            className="topology-panel__canvas-action"
            onClick={() => updateZoom(0.9)}
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            className="topology-panel__canvas-action topology-panel__canvas-action--wide"
            onClick={resetView}
            title="Reset zoom and pan"
          >
            Fit
          </button>
          <button
            type="button"
            className="topology-panel__canvas-action"
            onClick={() => updateZoom(1.1)}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="topology-panel__canvas-action topology-panel__canvas-action--wide"
            onClick={resetNodePositions}
            title="Reset dragged node positions"
          >
            Reset nodes
          </button>
          <button
            type="button"
            className="topology-panel__canvas-action topology-panel__canvas-action--wide"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Open full screen"}
          >
            {isFullscreen ? "Exit" : "Full"}
          </button>
        </div>
      </div>

      <TopologyScrollRail
        positionY={viewportMetrics.positionY}
        thumbRatioY={viewportMetrics.thumbRatioY}
        isEnabled={viewportMetrics.isVerticallyScrollable}
        onPositionChange={updateViewportPositionY}
      />

      <div
        id="topology-canvas-stage"
        className="topology-panel__stage"
        style={{
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
        }}
      >
        <svg
          className="topology-panel__edge-layer"
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="topology-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className="topology-panel__arrow"
              />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = positionedNodeMap.get(edge.sourceId);
            const target = positionedNodeMap.get(edge.targetId);
            if (!source || !target) return null;
            return (
              <path
                key={edge.id}
                d={buildEdgePath(source, target)}
                className={[
                  "topology-panel__edge",
                  `topology-panel__edge--${edge.kind}`,
                  edge.isPrimary ? "topology-panel__edge--primary" : "",
                  edge.isCrossLink ? "topology-panel__edge--cross" : "",
                  source.id === selectedNodeId || target.id === selectedNodeId
                    ? "topology-panel__edge--focused"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                markerEnd="url(#topology-arrow)"
              />
            );
          })}
        </svg>

        {positionedNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={[
              "topology-panel__node",
              `topology-panel__node--${node.kind}`,
              node.id === selectedNodeId
                ? "topology-panel__node--selected"
                : "",
              node.isFocus ? "topology-panel__node--focus" : "",
              node.isVisible ? "topology-panel__node--visible" : "",
              draggedPositions[node.id] ? "topology-panel__node--dragged" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${node.x - bounds.minX}px`,
              top: `${node.y - bounds.minY}px`,
            }}
            title={node.description || node.subtitle}
            onPointerDown={beginNodeDrag(node)}
          >
            <div className="topology-panel__node-header">
              <span className="topology-panel__node-icon">{node.icon}</span>
              <span className="topology-panel__node-drag">drag</span>
            </div>
            <div className="topology-panel__node-title">{node.label}</div>
            <div className="topology-panel__node-subtitle">
              {formatId(node.id)}
            </div>
            <div className="topology-panel__node-footer">
              <span>{node.outgoingCount} out</span>
              <span>{node.incomingCount} in</span>
              {node.hiddenNeighborCount > 0 && (
                <span className="topology-panel__node-hidden">
                  +{node.hiddenNeighborCount} hidden
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {graph.nodes.length === 0 && (
        <div className="topology-panel__empty">
          No visible nodes for the current topology. Try widening the radius or
          relaxing the sidebar filters.
        </div>
      )}
    </div>
  );
};
