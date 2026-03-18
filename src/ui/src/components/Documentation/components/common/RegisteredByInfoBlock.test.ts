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

    expect(screen.getByText("Registration source unavailable")).toBeTruthy();
  });

  it("links root-level registrations to the application root resource", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "task-card",
        registeredBy: "app",
      })
    );

    const link = screen.getByRole("link", { name: "app" });
    expect(link.getAttribute("href")).toBe("#element-app");
  });

  it("resolves the owner through the introspector when the serialized value is missing", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "task-card",
        elementId: "app.catalog.tasks.search",
        registeredBy: null,
        introspector: {
          getRegisteredByResourceId: () => "app.catalog",
        },
      })
    );

    const link = screen.getByRole("link", { name: "app.catalog" });
    expect(link.getAttribute("href")).toBe("#element-app.catalog");
  });

  it("renders a fancier non-link root state for the root resource itself", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "resource-card",
        registeredBy: null,
        isCurrentRootResource: true,
      })
    );

    expect(
      screen.queryByRole("link", { name: /Application Shell|app/ })
    ).toBeNull();
    expect(screen.getByText("Root-level registration")).toBeTruthy();
  });

  it("keeps the generic fallback when no registrar is available", () => {
    render(
      React.createElement(RegisteredByInfoBlock, {
        prefix: "task-card",
        registeredBy: null,
      })
    );

    expect(screen.getByText("Registration source unavailable")).toBeTruthy();
  });
});
