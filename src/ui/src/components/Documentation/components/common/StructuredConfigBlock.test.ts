/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { StructuredConfigBlock } from "./StructuredConfigBlock";

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

describe("StructuredConfigBlock", () => {
  it("renders the empty state for missing configuration", () => {
    render(React.createElement(StructuredConfigBlock, { value: null }));

    expect(screen.getByText("No configuration defined")).toBeTruthy();
  });

  it("renders the empty state for empty object configuration", () => {
    render(React.createElement(StructuredConfigBlock, { value: "{}" }));

    expect(screen.getByText("No configuration defined")).toBeTruthy();
    expect(screen.queryByTestId("json-viewer")).toBeNull();
  });

  it("renders JSON for non-empty object configuration", () => {
    render(
      React.createElement(StructuredConfigBlock, {
        value: '{"mode":"strict"}',
      })
    );

    expect(screen.getByTestId("json-viewer").textContent).toBe(
      '{"mode":"strict"}'
    );
  });

  it("renders formatted raw text for non-json configuration", () => {
    render(
      React.createElement(StructuredConfigBlock, {
        value: "plain text config",
      })
    );

    expect(screen.getByText("plain text config")).toBeTruthy();
  });
});
