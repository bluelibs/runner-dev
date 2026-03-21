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

  it("rejects malformed focus payloads", () => {
    localStorage.setItem(
      TOPOLOGY_PANEL_STORAGE_KEY,
      JSON.stringify({
        focus: { kind: "resource", id: 123 },
        view: "blast",
      })
    );

    expect(readStoredTopologyPanelState()).toBeNull();

    localStorage.setItem(
      TOPOLOGY_PANEL_STORAGE_KEY,
      JSON.stringify({
        focus: { kind: "not-a-real-kind", id: "resource.root" },
        view: "blast",
      })
    );

    expect(readStoredTopologyPanelState()).toBeNull();
  });
});
