/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentationMainContent } from "./DocumentationMainContent";

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
jest.mock("./ElementTable", () => ({ ElementTable: () => null }));
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
});
