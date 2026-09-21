/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ElementTable, type BaseElement } from "./ElementTable";

jest.mock("../utils/markdownUtils", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));
jest.mock("./ElementTable.scss", () => ({}));
jest.mock("./common/OverviewIdLink.scss", () => ({}), { virtual: true });

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

  it("renders no visibility column", () => {
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    expect(
      screen.queryByRole("columnheader", { name: /visibility/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /visibility/i })).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
  });

  it("marks private elements under the title only", () => {
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    const markers = screen.getAllByText("private");
    expect(markers).toHaveLength(2);
    markers.forEach((marker) => {
      expect(marker.className).toContain("element-table__private-marker");
      expect(marker.closest(".element-table__cell--title")).not.toBeNull();
    });
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

  it("shows both middleware scopes by default when middleware filters are enabled", () => {
    const middlewareElements: BaseElement[] = [
      {
        id: "enhanced-app.middlewares.task.audit",
        type: "task",
        meta: { title: "Task Audit" },
      },
      {
        id: "enhanced-app.middlewares.resource.metrics",
        type: "resource",
        meta: { title: "Resource Metrics" },
      },
    ];

    render(
      <ElementTable
        elements={middlewareElements}
        resources={resources}
        title="Middleware Overview"
        middlewareTypeFilters
      />
    );

    expect(screen.getByRole("button", { name: "For Tasks" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", { name: "For Resources" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Task Audit")).toBeInTheDocument();
    expect(screen.getByText("Resource Metrics")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("filters middleware overview rows by task and resource toggles", () => {
    const middlewareElements: BaseElement[] = [
      {
        id: "enhanced-app.middlewares.task.audit",
        type: "task",
        meta: { title: "Task Audit" },
      },
      {
        id: "enhanced-app.middlewares.resource.metrics",
        type: "resource",
        meta: { title: "Resource Metrics" },
      },
    ];

    render(
      <ElementTable
        elements={middlewareElements}
        resources={resources}
        title="Middleware Overview"
        middlewareTypeFilters
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "For Resources" }));
    expect(screen.getByText("Task Audit")).toBeInTheDocument();
    expect(screen.queryByText("Resource Metrics")).not.toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.queryByText("R")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "For Tasks" }));
    expect(screen.queryByText("Task Audit")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource Metrics")).not.toBeInTheDocument();
    expect(screen.queryByText("T")).not.toBeInTheDocument();
    expect(screen.queryByText("R")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "For Resources" }));
    expect(screen.getByText("Resource Metrics")).toBeInTheDocument();
    expect(screen.queryByText("Task Audit")).not.toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.queryByText("T")).not.toBeInTheDocument();
  });

  it("focuses the ID search when the table opens", () => {
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    expect(document.activeElement).toBe(
      screen.getByRole("searchbox", { name: "Search by ID" })
    );
  });

  it("matches titles fuzzily across word order and gaps", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search by Title" }),
      {
        target: { value: "sync proj" },
      }
    );

    expect(getRenderedIds(container)).toEqual([
      "...>catalog > catalogOnEnabled",
    ]);
  });

  it("keeps sort buttons out of the tab order between search inputs", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    const sortButtons = Array.from(
      container.querySelectorAll(".element-table__sort-btn")
    );
    expect(sortButtons.length).toBeGreaterThan(0);
    sortButtons.forEach((button) => {
      expect((button as HTMLElement).tabIndex).toBe(-1);
    });
  });

  it("matches ids fuzzily across separators", () => {
    const { container } = render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Tasks Overview"
      />
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search by ID" }), {
      target: { value: "zlst" },
    });

    expect(getRenderedIds(container)).toEqual(["enhanced-app > z-last"]);
  });

  it("shows a Shell action per row for resources", () => {
    const onAction = jest.fn();
    render(
      <ElementTable
        elements={elements}
        resources={resources}
        title="Resources Overview"
        enableActions="resource"
        onAction={onAction}
      />
    );

    const shellButtons = screen.getAllByRole("button", { name: "Shell" });
    expect(shellButtons).toHaveLength(elements.length);

    fireEvent.click(shellButtons[0]);
    expect(onAction).toHaveBeenCalledWith(elements[0]);
  });
});
