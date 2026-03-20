import type { TopologyGraphNode } from "../utils/topologyGraph";

export interface TopologyCanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface TopologyViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const BOUNDS_PADDING = 180;
const MIN_STAGE_SPAN = 480;
const DEFAULT_STAGE_SIZE = 1200;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.9;

export function getTopologyCanvasBounds(
  nodes: TopologyGraphNode[],
  draggedPositions: Record<string, { x: number; y: number }>
): TopologyCanvasBounds {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: DEFAULT_STAGE_SIZE,
      maxY: DEFAULT_STAGE_SIZE,
      width: DEFAULT_STAGE_SIZE,
      height: DEFAULT_STAGE_SIZE,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const position = draggedPositions[node.id] ?? node;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x);
    maxY = Math.max(maxY, position.y);
  }

  // Auto-fit should follow the visible graph footprint instead of dragging
  // the stage back to the origin with empty space.
  const paddedMinX = minX - BOUNDS_PADDING;
  const paddedMinY = minY - BOUNDS_PADDING;
  const paddedMaxX = Math.max(
    maxX + BOUNDS_PADDING,
    paddedMinX + MIN_STAGE_SPAN
  );
  const paddedMaxY = Math.max(
    maxY + BOUNDS_PADDING,
    paddedMinY + MIN_STAGE_SPAN
  );

  return {
    minX: paddedMinX,
    minY: paddedMinY,
    maxX: paddedMaxX,
    maxY: paddedMaxY,
    width: paddedMaxX - paddedMinX,
    height: paddedMaxY - paddedMinY,
  };
}

export function getZoomedViewport(
  viewport: TopologyViewportState,
  factor: number
): TopologyViewportState {
  return {
    ...viewport,
    scale: clampTopologyScale(viewport.scale * factor),
  };
}

export function clampTopologyScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function getInitialTopologyViewport(
  isFullscreen: boolean
): TopologyViewportState {
  return {
    scale: isFullscreen ? 0.92 : 0.74,
    offsetX: 0,
    offsetY: 0,
  };
}
