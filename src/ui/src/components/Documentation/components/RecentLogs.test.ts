/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Introspector } from "../../../../../resources/models/Introspector";
import { RecentLogs } from "./live/RecentLogs";

jest.mock("./JsonViewer", () => () => React.createElement("div", null, "json-viewer"));
jest.mock("./modals", () => ({
  BaseModal: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
  }) => (isOpen ? React.createElement("div", null, children) : null),
}));

function createIntrospectorMock(): Introspector {
  const source = {
    id: "enhanced-app.features.tasks.server",
    registeredBy: "enhanced-app.features",
    meta: { title: "Server" },
  };

  return {
    getResources: () => [
      { id: "enhanced-app", registeredBy: null },
      { id: "enhanced-app.features", registeredBy: "enhanced-app" },
    ],
    getTask: (id: string) => (id === source.id ? source : null),
    getHook: () => null,
    getResource: () => null,
    getEvent: () => null,
    getMiddleware: () => null,
    getError: () => null,
    getAsyncContext: () => null,
    getTag: () => null,
  } as unknown as Introspector;
}

describe("RecentLogs", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn();
    window.location.hash = "#live";
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("renders overview-style source labels while keeping canonical anchors", () => {
    const target = document.createElement("div");
    target.id = "element-enhanced-app.features.tasks.server";
    document.body.appendChild(target);

    render(
      React.createElement(RecentLogs, {
        introspector: createIntrospectorMock(),
        logs: [
          {
            timestampMs: Date.now(),
            level: "info",
            message: "Server ready",
            sourceId: "enhanced-app.features.tasks.server",
          },
        ],
      })
    );

    const expandButton = screen.getByRole("button", {
      name: /expand full source id for enhanced-app\.features\.tasks\.server/i,
    });
    const link = screen.getByRole("link", {
      name: /features\s*>\s*server/i,
    });

    expect(link.getAttribute("href")).toBe(
      "#element-enhanced-app.features.tasks.server"
    );
    expect(link.getAttribute("title")).toBe(
      "enhanced-app.features.tasks.server"
    );

    fireEvent.click(link);
    expect(window.location.hash).toBe(
      "#element-enhanced-app.features.tasks.server"
    );

    fireEvent.click(expandButton);
    expect(
      screen.getByRole("link", {
        name: /enhanced-app\s*>\s*features\s*>\s*server/i,
      })
    ).toBeTruthy();
  });

  it("falls back to the raw source id when the element is unknown", () => {
    render(
      React.createElement(RecentLogs, {
        introspector: createIntrospectorMock(),
        logs: [
          {
            timestampMs: Date.now(),
            level: "warn",
            message: "Unknown source",
            sourceId: "server",
          },
        ],
      })
    );

    const link = screen.getByRole("link", { name: "server" });
    expect(link.getAttribute("href")).toBe("#element-server");
    expect(link.getAttribute("title")).toBe("server");
  });
});
