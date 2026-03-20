/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TopologyActionButton } from "./TopologyActionButton";

describe("TopologyActionButton", () => {
  beforeEach(() => {
    window.location.hash = "#overview";
    localStorage.clear();
  });

  it("prefers the default lens for the focused kind over stored topology state", () => {
    localStorage.setItem(
      "docs-topology-state",
      JSON.stringify({
        focus: { kind: "task", id: "task.current" },
        view: "mindmap",
        radius: 4,
        autoOrder: false,
      })
    );

    render(
      React.createElement(TopologyActionButton, {
        focus: { kind: "task", id: "task.orders.create" },
        label: "Open topology",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Open topology" }));

    expect(window.location.hash).toBe("#topology/task/task.orders.create");
  });

  it("keeps honoring an explicit view override", () => {
    localStorage.setItem(
      "docs-topology-state",
      JSON.stringify({
        focus: { kind: "resource", id: "resource.root" },
        view: "mindmap",
        radius: 2,
        autoOrder: true,
      })
    );

    render(
      React.createElement(TopologyActionButton, {
        focus: { kind: "task", id: "task.orders.create" },
        view: "blast",
        label: "Open topology",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Open topology" }));

    expect(window.location.hash).toBe("#topology/task/task.orders.create");
  });
});
