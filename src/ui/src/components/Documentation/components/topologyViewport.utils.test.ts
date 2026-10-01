/** @jest-environment node */

import type { TopologyCanvasBounds } from "./topologyCanvas.utils";
import {
  clampViewportToBounds,
  COMPACT_TOPOLOGY_CANVAS_INSETS,
  getFittedViewport,
  getTopologyCanvasLayout,
  TOPOLOGY_CANVAS_INSETS,
  getViewportMetrics,
  getViewportPositionY,
  setViewportPositionY,
} from "./topologyViewport.utils";
import { describe, expect, it } from "@jest/globals";

const tallBounds: TopologyCanvasBounds = {
  minX: 0,
  minY: 0,
  maxX: 1200,
  maxY: 2400,
  width: 1200,
  height: 2400,
};

describe("topologyViewport.utils", () => {
  it("computes a smaller thumb ratio for tall graphs", () => {
    const metrics = getViewportMetrics(
      tallBounds,
      {
        scale: 1,
        offsetX: 116,
        offsetY: 92,
      },
      {
        width: 1200,
        height: 900,
      }
    );

    expect(metrics.isVerticallyScrollable).toBe(true);
    expect(metrics.thumbRatioY).toBeCloseTo(724 / 2400, 3);
    expect(metrics.positionY).toBe(0);
  });

  it("converts a normalized rail position into a clamped viewport offset", () => {
    const movedViewport = setViewportPositionY(
      tallBounds,
      {
        scale: 1,
        offsetX: 50,
        offsetY: 92,
      },
      {
        width: 1200,
        height: 900,
      },
      1
    );

    expect(movedViewport.offsetY).toBe(92 + 724 - 2400);
    expect(
      getViewportPositionY(tallBounds, movedViewport, {
        width: 1200,
        height: 900,
      })
    ).toBe(1);
  });

  it("centers smaller graphs instead of pretending they can scroll", () => {
    const compactBounds: TopologyCanvasBounds = {
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 600,
      width: 500,
      height: 600,
    };

    const clamped = clampViewportToBounds(
      compactBounds,
      {
        scale: 1,
        offsetX: -100,
        offsetY: -120,
      },
      {
        width: 1200,
        height: 900,
      }
    );

    expect(clamped.offsetX).toBeGreaterThan(116);
    expect(clamped.offsetY).toBeGreaterThan(92);
    expect(
      getViewportMetrics(compactBounds, clamped, {
        width: 1200,
        height: 900,
      }).isVerticallyScrollable
    ).toBe(false);
  });

  it("fits compact graphs to the available viewport", () => {
    const compactBounds: TopologyCanvasBounds = {
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 600,
      width: 500,
      height: 600,
    };

    const fitted = getFittedViewport(compactBounds, {
      width: 1200,
      height: 900,
    });

    expect(fitted.scale).toBeGreaterThan(1);
    expect(fitted.offsetX).toBeGreaterThan(116);
    expect(fitted.offsetY).toBe(92);
  });

  describe("getTopologyCanvasLayout", () => {
    it("keeps the desktop gutters on wide canvases", () => {
      expect(getTopologyCanvasLayout({ width: 1200, height: 900 })).toEqual({
        insets: TOPOLOGY_CANVAS_INSETS,
        minScale: 0.55,
      });
    });

    it("switches to compact insets and a lower floor on phone canvases", () => {
      expect(getTopologyCanvasLayout({ width: 329, height: 480 })).toEqual({
        insets: COMPACT_TOPOLOGY_CANVAS_INSETS,
        minScale: 0.25,
      });
    });

    it("stays on the desktop layout until the canvas is measured", () => {
      expect(getTopologyCanvasLayout({ width: 0, height: 0 }).insets).toBe(
        TOPOLOGY_CANVAS_INSETS
      );
    });
  });

  it("fits a large graph below the desktop zoom floor on a phone canvas", () => {
    const phoneCanvas = { width: 329, height: 480 };
    const { insets, minScale } = getTopologyCanvasLayout(phoneCanvas);

    const fitted = getFittedViewport(tallBounds, phoneCanvas, insets, minScale);

    expect(fitted.scale).toBeLessThan(0.55);
    expect(fitted.scale).toBeGreaterThanOrEqual(minScale);
    expect(fitted.offsetX).toBeGreaterThanOrEqual(insets.left);
  });
});
