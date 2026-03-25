/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { StructuredDataPanel } from "./StructuredDataPanel";

jest.mock("./StructuredDataPanel.scss", () => ({}), { virtual: true });
jest.mock("../JsonViewer", () => ({
  __esModule: true,
  default: ({ data, className }: { data: object; className?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "json-viewer", className },
      JSON.stringify(data)
    ),
}));

describe("StructuredDataPanel", () => {
  it("renders empty objects through the JSON viewer", () => {
    render(
      React.createElement(StructuredDataPanel, {
        data: {},
        emptyLabel: "No schema defined",
      })
    );

    expect(screen.getByTestId("json-viewer")).toHaveTextContent("{}");
    expect(screen.queryByText("No schema defined")).toBeNull();
  });
});
