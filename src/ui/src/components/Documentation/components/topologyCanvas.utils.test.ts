/** @jest-environment node */

import {
  clampTopologyScale,
  getInitialTopologyViewport,
  getTopologyCanvasBounds,
  getZoomedViewport,
} from "./topologyCanvas.utils";

describe("topologyCanvas.utils", () => {
  it("expands bounds around nodes and dragged positions", () => {
    const bounds = getTopologyCanvasBounds(
      [
        {
          id: "resource.root",
          kind: "resource",
          label: "Root",
          subtitle: "resource.root",
          icon: "r",
          x: 220,
          y: 260,
          depth: 0,
          order: 0,
          parentId: null,
          parentRelationKind: null,
          isFocus: true,
          isVisible: true,
          hiddenNeighborCount: 0,
          incomingCount: 0,
          outgoingCount: 2,
          visibility: "public",
          pills: [],
        },
      ],
      {
        "resource.root": {
          x: 460,
          y: 520,
        },
      }
    );

    expect(bounds.minX).toBeLessThanOrEqual(280);
    expect(bounds.maxX).toBeGreaterThanOrEqual(640);
    expect(bounds.width).toBeGreaterThanOrEqual(480);
    expect(bounds.width).toBeLessThan(1200);
  });

  it("keeps viewport zoom inside sane limits", () => {
    expect(clampTopologyScale(0.1)).toBe(0.55);
    expect(clampTopologyScale(4)).toBe(1.9);

    const viewport = getInitialTopologyViewport(false);
    expect(getZoomedViewport(viewport, 10).scale).toBe(1.9);
    expect(getZoomedViewport(viewport, 0.1).scale).toBe(0.55);
  });
});
