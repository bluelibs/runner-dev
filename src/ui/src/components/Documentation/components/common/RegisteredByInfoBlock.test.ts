/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { RegisteredByInfoBlock } from "./RegisteredByInfoBlock";

jest.mock("./RegisteredByInfoBlock.scss", () => ({}), { virtual: true });

jest.mock("./ElementCard", () => ({
  InfoBlock: ({
    label,
    children,
  }: {
    label: React.ReactNode;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("strong", null, label),
      children
    ),
}));

describe("RegisteredByInfoBlock", () => {
  it("renders a registrar link when the owner exists", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "task-card",
        registeredBy: "app.resources.catalog",
      })
    );

    const link = screen.getByRole("link", { name: "app.resources.catalog" });
    expect(link.getAttribute("href")).toBe("#element-app.resources.catalog");
  });

  it("renders a fallback label when no registrar is available", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "task-card",
        registeredBy: null,
      })
    );

    expect(screen.getByText("Direct / root-level")).toBeTruthy();
  });
});
