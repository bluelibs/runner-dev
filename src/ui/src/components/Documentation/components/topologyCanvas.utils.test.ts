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

  it("keeps centered positive-space layouts anchored to their visible bounds", () => {
    const bounds = getTopologyCanvasBounds(
      [
        {
          id: "resource.center",
          kind: "resource",
          label: "Center",
          subtitle: "resource.center",
          icon: "r",
          x: 500,
          y: 500,
          depth: 0,
          order: 0,
          parentId: null,
          parentRelationKind: null,
          isFocus: true,
          isVisible: true,
          hiddenNeighborCount: 0,
          incomingCount: 1,
          outgoingCount: 2,
          visibility: "public",
          pills: [],
        },
        {
          id: "resource.left",
          kind: "resource",
          label: "Left",
          subtitle: "resource.left",
          icon: "r",
          x: 335,
          y: 500,
          depth: 1,
          order: 1,
          parentId: "resource.center",
          parentRelationKind: "used-by",
          isFocus: false,
          isVisible: true,
          hiddenNeighborCount: 0,
          incomingCount: 1,
          outgoingCount: 0,
          visibility: "public",
          pills: [],
        },
        {
          id: "resource.bottom",
          kind: "resource",
          label: "Bottom",
          subtitle: "resource.bottom",
          icon: "r",
          x: 500,
          y: 720,
          depth: 1,
          order: 2,
          parentId: "resource.center",
          parentRelationKind: "used-by",
          isFocus: false,
          isVisible: true,
          hiddenNeighborCount: 0,
          incomingCount: 1,
          outgoingCount: 0,
          visibility: "public",
          pills: [],
        },
      ],
      {}
    );

    expect(bounds.minX).toBe(155);
    expect(bounds.minY).toBe(320);
    expect(bounds.width).toBe(525);
    expect(bounds.height).toBe(580);
  });

  it("keeps viewport zoom inside sane limits", () => {
    expect(clampTopologyScale(0.1)).toBe(0.55);
    expect(clampTopologyScale(4)).toBe(1.9);

    const viewport = getInitialTopologyViewport(false);
    expect(getZoomedViewport(viewport, 10).scale).toBe(1.9);
    expect(getZoomedViewport(viewport, 0.1).scale).toBe(0.55);
  });
});
