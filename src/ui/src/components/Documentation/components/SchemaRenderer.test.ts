/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SchemaRenderer } from "./SchemaRenderer";

jest.mock("./SchemaRenderer.scss", () => ({}), { virtual: true });
jest.mock("./common/StructuredDataPanel.scss", () => ({}), { virtual: true });
jest.mock("./chat/ChatUtils", () => ({
  copyToClipboard: jest.fn(async () => true),
}));
jest.mock("./JsonViewer", () => ({
  __esModule: true,
  default: ({ data, className }: { data: object; className?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "json-viewer", className },
      JSON.stringify(data)
    ),
}));

describe("SchemaRenderer", () => {
  it("shows the empty state in the json tab when no schema is defined", () => {
    render(React.createElement(SchemaRenderer, { schemaString: null }));

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getAllByText("No schema defined").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("json-viewer")).toBeNull();
    expect(screen.getByLabelText("Copy code").hasAttribute("disabled")).toBe(
      true
    );
  });

  it("shows only the form controls in the form tab", () => {
    render(
      React.createElement(SchemaRenderer, {
        schemaString: JSON.stringify({
          type: "object",
          properties: {
            mode: {
              type: "string",
              title: "Mode",
            },
          },
        }),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Form" }));

    expect(screen.getByText("Mode")).toBeTruthy();
    expect(screen.getByDisplayValue("mode-sample")).toBeTruthy();
    expect(screen.queryByLabelText("Copy code")).toBeNull();
    expect(screen.queryByTestId("json-viewer")).toBeNull();
  });
});
