/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ElementTable, type BaseElement } from "./ElementTable";

jest.mock("../utils/markdownUtils", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));
jest.mock("./ElementTable.scss", () => ({}));

describe("ElementTable", () => {
  const elements: BaseElement[] = [
    {
      id: "enhanced-app.events.z-last",
      meta: { title: "Bravo Two" },
      isPrivate: true,
    },
    {
      id: "enhanced-app.features.tasks.alphaTen",
      meta: { title: "Alpha Ten" },
      registeredBy: "enhanced-app.features",
    },
    {
      id: "enhanced-app.features.hooks.alphaTwo",
      meta: { title: "Alpha Two" },
      isPrivate: true,
      registeredBy: "enhanced-app.features.deep",
    },
    {
      id: "enhanced-superapp.catalog.hooks.catalogOnEnabled",
      meta: { title: "Projection Sync" },
    },
  ];

  const resources: BaseElement[] = [
    { id: "enhanced-app", registeredBy: null },
    { id: "enhanced-app.features", registeredBy: "enhanced-app" },
    {
      id: "enhanced-app.features.deep",
      registeredBy: "enhanced-app.features",
    },
  ];

  const getRenderedIds = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll(".element-table__id-code")).map(
      (element) => element.textContent || ""
    );

  it("defaults to the original neutral up-down indicator and source order", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>features > alphaTen",
      "...>deep > alphaTwo",
      "...>catalog > catalogOnEnabled",
    ]);
    expect(
      container.querySelector(".element-table__sort-indicator--neutral")
        ?.textContent
    ).toBe("↑↓");
  });

  it("cycles id sorting through asc, desc, and back to neutral", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^id$/i }));

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>deep > alphaTwo",
      "...>features > alphaTen",
      "...>catalog > catalogOnEnabled",
    ]);

    fireEvent.click(screen.getByRole("button", { name: /^id$/i }));

    expect(getRenderedIds(container)).toEqual([
      "...>catalog > catalogOnEnabled",
      "...>features > alphaTen",
      "...>deep > alphaTwo",
      "enhanced-app > z-last",
    ]);

    fireEvent.click(screen.getByRole("button", { name: /^id$/i }));

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>features > alphaTen",
      "...>deep > alphaTwo",
      "...>catalog > catalogOnEnabled",
    ]);
  });

  it("sorts by visibility when clicking the visibility column", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    expect(
      screen
        .getByRole("columnheader", { name: /visibility/i })
        .getAttribute("aria-sort")
    ).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /visibility/i }));

    expect(getRenderedIds(container)).toEqual([
      "...>features > alphaTen",
      "...>catalog > catalogOnEnabled",
      "enhanced-app > z-last",
      "...>deep > alphaTwo",
    ]);

    fireEvent.click(screen.getByRole("button", { name: /visibility/i }));

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>deep > alphaTwo",
      "...>features > alphaTen",
      "...>catalog > catalogOnEnabled",
    ]);

    fireEvent.click(screen.getByRole("button", { name: /visibility/i }));

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>features > alphaTen",
      "...>deep > alphaTwo",
      "...>catalog > catalogOnEnabled",
    ]);
  });

  it("renders visibility as badge labels", () => {
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    expect(screen.getAllByText("Private")).toHaveLength(2);
    expect(screen.getAllByText("Public")).toHaveLength(2);
  });

  it("keeps canonical ids in links and hover titles while rendering display ids", () => {
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    const firstLink = screen.getByRole("link", {
      name: /features\s*>\s*alphaTen/i,
    });

    expect(firstLink.getAttribute("href")).toBe(
      "#element-enhanced-app.features.tasks.alphaTen"
    );
    expect(firstLink.getAttribute("title")).toBe(
      "enhanced-app.features.tasks.alphaTen"
    );
  });

  it("expands hidden ancestry when clicking the ellipsis control", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /expand full id for enhanced-app\.features\.hooks\.alphaTwo/i,
      })
    );

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>features > alphaTen",
      "−enhanced-app > features > deep > alphaTwo",
      "...>catalog > catalogOnEnabled",
    ]);

    fireEvent.click(
      screen.getByRole("button", {
        name: /collapse full id for enhanced-app\.features\.hooks\.alphaTwo/i,
      })
    );

    expect(getRenderedIds(container)).toEqual([
      "enhanced-app > z-last",
      "...>features > alphaTen",
      "...>deep > alphaTwo",
      "...>catalog > catalogOnEnabled",
    ]);
  });
});
