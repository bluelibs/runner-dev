/** @jest-environment node */

import type { TopologyCanvasBounds } from "./topologyCanvas.utils";
import {
  clampViewportToBounds,
  getFittedViewport,
  getViewportMetrics,
  getViewportPositionY,
  setViewportPositionY,
} from "./topologyViewport.utils";

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
    expect(fitted.offsetY).toBeGreaterThan(92);
  });
});
