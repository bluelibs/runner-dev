/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TopologyToolbar } from "./TopologyToolbar";

const mockTooltip = jest.fn(() => null);

jest.mock("./TopologyDescriptionTooltip", () => ({
  TopologyDescriptionTooltip: (props: unknown) => mockTooltip(props),
}));

describe("TopologyToolbar", () => {
  afterEach(() => {
    mockTooltip.mockClear();
  });

  it("renders explainer tooltips for both topology lenses", () => {
    render(
      React.createElement(TopologyToolbar, {
        view: "mindmap",
        radius: 2,
        autoOrder: true,
        isNavigatorOpen: true,
        canOpenSelectedCard: true,
        onViewChange: () => {},
        onRadiusChange: () => {},
        onReset: () => {},
        onOpenSelectedCard: () => {},
        onToggleAutoOrder: () => {},
        onToggleNavigator: () => {},
      })
    );

    expect(screen.getByRole("button", { name: "Blast Radius" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mindmap" })).toBeTruthy();
    expect(mockTooltip).toHaveBeenCalledTimes(2);

    expect(mockTooltip).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        label: "Blast Radius",
        description: expect.stringContaining(
          "follows the focused node's outward impact chain"
        ),
      })
    );
    expect(mockTooltip).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        label: "Mindmap",
        description: expect.stringContaining(
          "primary spine stays anchored on `registers` relationships"
        ),
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Blast Radius" }));
    fireEvent.click(screen.getByRole("button", { name: "Mindmap" }));
  });
});
