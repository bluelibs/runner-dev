/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DocIcon, isDocIconName } from "./DocIcon";

describe("DocIcon", () => {
  test("renders an svg for known icon names", () => {
    const { container } = render(
      React.createElement(DocIcon, { name: "resource", size: 20 })
    );
    const svg = container.querySelector("svg.doc-icon");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  test("falls back to raw text for unknown names", () => {
    render(React.createElement(DocIcon, { name: "•" }));
    expect(screen.getByText("•")).toBeTruthy();
  });

  test("passes class names through in both modes", () => {
    const { container, rerender } = render(
      React.createElement(DocIcon, { name: "task", className: "custom" })
    );
    expect(container.querySelector("svg.custom")).not.toBeNull();

    rerender(React.createElement(DocIcon, { name: "?", className: "custom" }));
    expect(container.querySelector("span.custom")).not.toBeNull();
  });

  test("isDocIconName guards known names", () => {
    expect(isDocIconName("terminal")).toBe(true);
    expect(isDocIconName("nope")).toBe(false);
  });
});
