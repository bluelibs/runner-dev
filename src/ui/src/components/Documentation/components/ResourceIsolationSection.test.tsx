/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResourceIsolationSection } from "./ResourceIsolationSection";

jest.mock("./common/ElementCard", () => ({
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
jest.mock("./common/OverviewIdLink.scss", () => ({}), { virtual: true });

describe("ResourceIsolationSection", () => {
  it("reuses the expandable overview id component for explicit export ids", () => {
    render(
      React.createElement(ResourceIsolationSection, {
        isolation: {
          exports: [
            "enhanced-app.catalog.public-catalog",
            "enhanced-app.catalog.tasks.catalog-search",
          ],
          deny: [],
          only: [],
          whitelist: [],
          exportsMode: "list",
        },
        onOpenWildcard: jest.fn(),
        resources: [
          { id: "enhanced-app", registeredBy: null },
          { id: "enhanced-app.catalog", registeredBy: "enhanced-app" },
        ],
        resolveReferenceElement: (id: string) => ({
          id,
          registeredBy: "enhanced-app.catalog",
        }),
      })
    );

    expect(
      screen.getByRole("button", {
        name: /expand full id for enhanced-app\.catalog\.public-catalog/i,
      })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /expand full id for enhanced-app\.catalog\.tasks\.catalog-search/i,
      })
    );

    expect(
      screen.getByRole("link", {
        name: /enhanced-app\s*>\s*catalog\s*>\s*catalog-search/i,
      })
    ).toBeTruthy();
  });
});
