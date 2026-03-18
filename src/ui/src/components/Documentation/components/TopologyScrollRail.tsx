import React from "react";
import {
  TOPOLOGY_SCROLLBAR_KEYBOARD_STEP,
  TOPOLOGY_SCROLLBAR_PAGE_STEP,
} from "./topologyViewport.utils";

const MIN_THUMB_HEIGHT = 92;

export interface TopologyScrollRailProps {
  positionY: number;
  thumbRatioY: number;
  isEnabled: boolean;
  onPositionChange: (positionY: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const TopologyScrollRail: React.FC<TopologyScrollRailProps> = ({
  positionY,
  thumbRatioY,
  isEnabled,
  onPositionChange,
}) => {
  const railRef = React.useRef<HTMLDivElement>(null);
  const pointerStateRef = React.useRef<{
    pointerId: number;
    dragOffsetY: number;
  } | null>(null);

  const getRailMetrics = React.useCallback(() => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const thumbHeight = Math.min(
      rect.height,
      Math.max(MIN_THUMB_HEIGHT, rect.height * thumbRatioY)
    );
    const maxTravel = Math.max(0, rect.height - thumbHeight);

    return {
      rect,
      thumbHeight,
      maxTravel,
      thumbTop: maxTravel * clamp(positionY, 0, 1),
    };
  }, [positionY, thumbRatioY]);

  const commitPointerPosition = React.useCallback(
    (clientY: number, dragOffsetY: number) => {
      if (!isEnabled) return;
      const metrics = getRailMetrics();
      if (!metrics) return;

      const nextTop = clamp(
        clientY - metrics.rect.top - dragOffsetY,
        0,
        metrics.maxTravel
      );
      onPositionChange(metrics.maxTravel > 0 ? nextTop / metrics.maxTravel : 0);
    },
    [getRailMetrics, isEnabled, onPositionChange]
  );

  const releasePointer = React.useCallback((pointerId: number) => {
    const rail = railRef.current;
    if (rail?.hasPointerCapture(pointerId)) {
      rail.releasePointerCapture(pointerId);
    }
    pointerStateRef.current = null;
  }, []);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const metrics = getRailMetrics();
      if (!metrics) return;

      const isThumbTarget =
        event.target instanceof HTMLElement &&
        event.target.dataset.topologyRailThumb === "true";
      const dragOffsetY = isThumbTarget
        ? event.clientY - metrics.rect.top - metrics.thumbTop
        : metrics.thumbHeight / 2;

      pointerStateRef.current = {
        pointerId: event.pointerId,
        dragOffsetY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      commitPointerPosition(event.clientY, dragOffsetY);
    },
    [commitPointerPosition, getRailMetrics]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      commitPointerPosition(event.clientY, pointerState.dragOffsetY);
    },
    [commitPointerPosition]
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerState = pointerStateRef.current;
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      releasePointer(event.pointerId);
    },
    [releasePointer]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isEnabled) return;

      const keyMap: Record<string, number> = {
        ArrowUp: -TOPOLOGY_SCROLLBAR_KEYBOARD_STEP,
        ArrowDown: TOPOLOGY_SCROLLBAR_KEYBOARD_STEP,
        PageUp: -TOPOLOGY_SCROLLBAR_PAGE_STEP,
        PageDown: TOPOLOGY_SCROLLBAR_PAGE_STEP,
      };

      if (event.key === "Home") {
        event.preventDefault();
        onPositionChange(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        onPositionChange(1);
        return;
      }

      const delta = keyMap[event.key];
      if (delta === undefined) return;
      event.preventDefault();
      onPositionChange(clamp(positionY + delta, 0, 1));
    },
    [isEnabled, onPositionChange, positionY]
  );

  const normalizedPosition = clamp(positionY, 0, 1);
  const thumbHeightPercent = Math.max(thumbRatioY * 100, 0);
  const thumbHeightStyle = `${thumbHeightPercent}%`;
  const thumbTopStyle = `calc((100% - ${thumbHeightStyle}) * ${normalizedPosition})`;

  return (
    <div
      ref={railRef}
      className={[
        "topology-panel__scroll-rail",
        isEnabled ? "" : "topology-panel__scroll-rail--disabled",
      ]
        .filter(Boolean)
        .join(" ")}
      role="scrollbar"
      aria-label="Topology vertical navigator"
      aria-controls="topology-canvas-stage"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedPosition * 100)}
      aria-disabled={!isEnabled}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="topology-panel__scroll-rail-track">
        <div
          className="topology-panel__scroll-rail-thumb"
          data-topology-rail-thumb="true"
          style={{
            height: thumbHeightStyle,
            top: thumbTopStyle,
          }}
        />
      </div>
    </div>
  );
};
