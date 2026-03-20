/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentationMainContent } from "./DocumentationMainContent";
import { getDocumentationIcon } from "../config/documentationIcons";

jest.mock("./TaskCard", () => ({ TaskCard: () => null }));
jest.mock("./ResourceCard", () => ({ ResourceCard: () => null }));
jest.mock("./MiddlewareCard", () => ({ MiddlewareCard: () => null }));
jest.mock("./EventCard", () => ({ EventCard: () => null }));
jest.mock("./HookCard", () => ({ HookCard: () => null }));
jest.mock("./TagCard", () => ({ TagCard: () => null }));
jest.mock("./ErrorCard", () => ({ ErrorCard: () => null }));
jest.mock("./AsyncContextCard", () => ({ AsyncContextCard: () => null }));
jest.mock("./DiagnosticsPanel", () => ({ DiagnosticsPanel: () => null }));
jest.mock("./LivePanel", () => ({ LivePanel: () => null }));
const elementTableMock = jest.fn(() => null);
jest.mock("./ElementTable", () => ({
  ElementTable: (props: any) => elementTableMock(props),
}));
jest.mock("./DocsSection", () => ({ DocsSection: () => null }));
jest.mock("./TopologyPanel", () => ({ TopologyPanel: () => null }));

function createIntrospectorStub() {
  return {
    getRoot: () => ({
      id: "app.root",
      meta: {
        title: "Runner Application Documentation",
        description: "Test description",
      },
    }),
    getRunOptions: () => ({
      mode: "default",
      debug: false,
      debugMode: "off",
      logsEnabled: true,
      logsPrintThreshold: "info",
      lifecycleMode: "serial",
      dryRun: false,
      lazy: false,
      errorBoundary: true,
      shutdownHooks: true,
      hasOnUnhandledError: false,
      logsPrintStrategy: "immediate",
      logsBuffer: true,
      executionContext: {
        enabled: true,
        cycleDetection: true,
      },
      dispose: {
        totalBudgetMs: 5000,
        drainingBudgetMs: 1000,
        cooldownWindowMs: 250,
      },
    }),
    getTask: () => null,
    getResource: () => null,
    getEvent: () => null,
    getHook: () => null,
    getMiddleware: () => null,
    getError: () => null,
    getAsyncContext: () => null,
    getTag: () => null,
  } as any;
}

describe("DocumentationMainContent", () => {
  beforeEach(() => {
    window.location.hash = "#overview";
    Element.prototype.scrollIntoView = jest.fn();
  });

  it("renders a visible stats label in the overview header", () => {
    const openStats = jest.fn();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        openStats,
        tasks: [],
        resources: [],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
          {
            id: "overview",
            label: "Overview",
            icon: "📋",
            count: null,
            hasContent: true,
          },
        ],
      })
    );

    const button = screen.getByRole("button", {
      name: "Open Performance Stats",
    });

    expect(screen.getByText("Stats")).toBeTruthy();

    fireEvent.click(button);

    expect(openStats).toHaveBeenCalledTimes(1);
  });

  it("disables task and event actions in catalog mode", () => {
    window.location.hash = "#tasks";
    elementTableMock.mockClear();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        mode: "catalog",
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.hello" }],
        resources: [],
        events: [{ id: "app.events.hello" }],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
          {
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 1,
            hasContent: true,
          },
          {
            id: "events",
            label: "Events",
            icon: getDocumentationIcon("events"),
            count: 1,
            hasContent: true,
          },
        ],
      })
    );

    expect(elementTableMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tasks",
        enableActions: undefined,
      })
    );
  });

  it("does not render the live section in catalog mode", () => {
    window.location.hash = "#live";

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        mode: "catalog",
        sidebarWidth: 0,
        tasks: [],
        resources: [],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
          {
            id: "live",
            label: "Live",
            icon: "📡",
            count: null,
            hasContent: true,
          },
        ],
      })
    );

    expect(screen.queryByText("📡 Live Telemetry")).toBeNull();
  });

  it("hides the stats button in catalog mode", () => {
    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        mode: "catalog",
        sidebarWidth: 0,
        tasks: [],
        resources: [],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
          {
            id: "overview",
            label: "Overview",
            icon: "📋",
            count: null,
            hasContent: true,
          },
        ],
      })
    );

    expect(
      screen.queryByRole("button", { name: "Open Performance Stats" })
    ).toBeNull();
  });
});
