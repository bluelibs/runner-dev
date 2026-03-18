import type {
  TopologyCanvasBounds,
  TopologyViewportState,
} from "./topologyCanvas.utils";
import { clampTopologyScale } from "./topologyCanvas.utils";

export interface TopologyCanvasSize {
  width: number;
  height: number;
}

export interface TopologyCanvasInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TopologyViewportMetrics {
  availableWidth: number;
  availableHeight: number;
  minOffsetX: number;
  maxOffsetX: number;
  minOffsetY: number;
  maxOffsetY: number;
  thumbRatioY: number;
  positionY: number;
  isVerticallyScrollable: boolean;
}

export const TOPOLOGY_CANVAS_INSETS: TopologyCanvasInsets = {
  top: 92,
  right: 64,
  bottom: 84,
  left: 116,
};

export const TOPOLOGY_SCROLLBAR_KEYBOARD_STEP = 0.08;
export const TOPOLOGY_SCROLLBAR_PAGE_STEP = 0.22;

const MIN_VIEWPORT_SIZE = 1;

function getAvailableSize(
  canvasSize: TopologyCanvasSize,
  insets: TopologyCanvasInsets
) {
  return {
    width: Math.max(
      MIN_VIEWPORT_SIZE,
      canvasSize.width - insets.left - insets.right
    ),
    height: Math.max(
      MIN_VIEWPORT_SIZE,
      canvasSize.height - insets.top - insets.bottom
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampViewportToBounds(
  bounds: TopologyCanvasBounds,
  viewport: TopologyViewportState,
  canvasSize: TopologyCanvasSize,
  insets: TopologyCanvasInsets = TOPOLOGY_CANVAS_INSETS
): TopologyViewportState {
  const { width: availableWidth, height: availableHeight } = getAvailableSize(
    canvasSize,
    insets
  );
  const scaledWidth = bounds.width * viewport.scale;
  const scaledHeight = bounds.height * viewport.scale;

  const centeredOffsetX =
    insets.left + Math.max(0, (availableWidth - scaledWidth) / 2);
  const centeredOffsetY =
    insets.top + Math.max(0, (availableHeight - scaledHeight) / 2);

  const minOffsetX = insets.left + availableWidth - scaledWidth;
  const maxOffsetX = insets.left;
  const minOffsetY = insets.top + availableHeight - scaledHeight;
  const maxOffsetY = insets.top;

  return {
    ...viewport,
    offsetX:
      scaledWidth <= availableWidth
        ? centeredOffsetX
        : clamp(viewport.offsetX, minOffsetX, maxOffsetX),
    offsetY:
      scaledHeight <= availableHeight
        ? centeredOffsetY
        : clamp(viewport.offsetY, minOffsetY, maxOffsetY),
  };
}

export function getViewportPositionY(
  bounds: TopologyCanvasBounds,
  viewport: TopologyViewportState,
  canvasSize: TopologyCanvasSize,
  insets: TopologyCanvasInsets = TOPOLOGY_CANVAS_INSETS
): number {
  const metrics = getViewportMetrics(bounds, viewport, canvasSize, insets);
  return metrics.positionY;
}

export function setViewportPositionY(
  bounds: TopologyCanvasBounds,
  viewport: TopologyViewportState,
  canvasSize: TopologyCanvasSize,
  positionY: number,
  insets: TopologyCanvasInsets = TOPOLOGY_CANVAS_INSETS
): TopologyViewportState {
  const metrics = getViewportMetrics(bounds, viewport, canvasSize, insets);
  if (!metrics.isVerticallyScrollable) {
    return clampViewportToBounds(bounds, viewport, canvasSize, insets);
  }

  const nextPosition = clamp(positionY, 0, 1);
  const travel = metrics.maxOffsetY - metrics.minOffsetY;
  return clampViewportToBounds(
    bounds,
    {
      ...viewport,
      offsetY: metrics.maxOffsetY - nextPosition * travel,
    },
    canvasSize,
    insets
  );
}

export function getViewportMetrics(
  bounds: TopologyCanvasBounds,
  viewport: TopologyViewportState,
  canvasSize: TopologyCanvasSize,
  insets: TopologyCanvasInsets = TOPOLOGY_CANVAS_INSETS
): TopologyViewportMetrics {
  const { width: availableWidth, height: availableHeight } = getAvailableSize(
    canvasSize,
    insets
  );
  const scaledWidth = bounds.width * viewport.scale;
  const scaledHeight = bounds.height * viewport.scale;
  const maxOffsetX = insets.left;
  const minOffsetX = insets.left + availableWidth - scaledWidth;
  const maxOffsetY = insets.top;
  const minOffsetY = insets.top + availableHeight - scaledHeight;
  const isVerticallyScrollable = scaledHeight > availableHeight;
  const travelY = Math.max(0, maxOffsetY - minOffsetY);
  const clampedViewport = clampViewportToBounds(
    bounds,
    viewport,
    canvasSize,
    insets
  );

  return {
    availableWidth,
    availableHeight,
    minOffsetX,
    maxOffsetX,
    minOffsetY,
    maxOffsetY,
    thumbRatioY: clamp(availableHeight / Math.max(scaledHeight, 1), 0, 1),
    positionY:
      !isVerticallyScrollable || travelY === 0
        ? 0
        : clamp((maxOffsetY - clampedViewport.offsetY) / travelY, 0, 1),
    isVerticallyScrollable,
  };
}

export function getFittedViewport(
  bounds: TopologyCanvasBounds,
  canvasSize: TopologyCanvasSize,
  insets: TopologyCanvasInsets = TOPOLOGY_CANVAS_INSETS
): TopologyViewportState {
  const { width: availableWidth, height: availableHeight } = getAvailableSize(
    canvasSize,
    insets
  );
  const fittedScale = clampTopologyScale(
    Math.min(
      availableWidth / Math.max(bounds.width, MIN_VIEWPORT_SIZE),
      availableHeight / Math.max(bounds.height, MIN_VIEWPORT_SIZE)
    )
  );

  return clampViewportToBounds(
    bounds,
    {
      scale: fittedScale,
      offsetX: insets.left,
      offsetY: insets.top,
    },
    canvasSize,
    insets
  );
}
