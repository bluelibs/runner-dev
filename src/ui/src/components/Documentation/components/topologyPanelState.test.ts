/** @jest-environment jsdom */

import {
  readStoredTopologyPanelState,
  TOPOLOGY_PANEL_STORAGE_KEY,
} from "./topologyPanelState";

describe("topologyPanelState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores the navigator visibility preference from storage", () => {
    localStorage.setItem(
      TOPOLOGY_PANEL_STORAGE_KEY,
      JSON.stringify({
        focus: { kind: "resource", id: "resource.root" },
        view: "mindmap",
        radius: 3,
        autoOrder: true,
        isNavigatorOpen: false,
      })
    );

    expect(readStoredTopologyPanelState()).toEqual({
      focus: { kind: "resource", id: "resource.root" },
      view: "mindmap",
      radius: 3,
      autoOrder: true,
      isNavigatorOpen: false,
    });
  });
});
