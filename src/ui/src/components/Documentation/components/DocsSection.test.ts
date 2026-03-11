/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocsSection } from "./DocsSection";

jest.mock("../utils/markdownUtils", () => ({
  MarkdownRenderer: ({
    content,
    className,
  }: {
    content: string;
    className?: string;
  }) => React.createElement("div", { className }, content),
}));

describe("DocsSection", () => {
  it("renders the minimal guide first and switches to complete", () => {
    render(
      React.createElement(DocsSection, {
        docsContent: {
          minimalMd: "# Minimal Guide",
          completeMd: "# Complete Guide",
        },
      })
    );

    expect(screen.getByText("# Minimal Guide")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Complete" }));
    expect(screen.getByText("# Complete Guide")).toBeTruthy();
  });

  it("renders only the available tab when one document is missing", () => {
    render(
      React.createElement(DocsSection, {
        docsContent: {
          minimalMd: "",
          completeMd: "# Complete Guide",
        },
      })
    );

    expect(screen.queryByRole("tab", { name: "Minimal" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Complete" })).toBeTruthy();
    expect(screen.getByText("# Complete Guide")).toBeTruthy();
  });

  it("supports a custom anchor and heading for overview embedding", () => {
    render(
      React.createElement(DocsSection, {
        id: "docs-support",
        title: "📚 Docs & Support",
        description: "Embedded docs block",
        docsContent: {
          minimalMd: "# Minimal Guide",
          completeMd: "",
        },
      })
    );

    expect(document.getElementById("docs-support")).toBeTruthy();
    expect(screen.getByText("📚 Docs & Support")).toBeTruthy();
    expect(screen.getByText("Embedded docs block")).toBeTruthy();
  });
});
