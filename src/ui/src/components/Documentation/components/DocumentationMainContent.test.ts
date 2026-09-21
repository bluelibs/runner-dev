/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
const executeModalMock = jest.fn(() => null);
jest.mock("./ExecuteModal", () => ({
  __esModule: true,
  default: (props: any) => executeModalMock(props),
}));
const shellModalMock = jest.fn(() => null);
jest.mock("./ShellModal", () => ({
  __esModule: true,
  default: (props: any) => shellModalMock(props),
}));

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

  it("opens the runtime shell from the overview header", () => {
    const listener = jest.fn();
    window.addEventListener("docs:open-shell", listener);

    try {
      render(
        React.createElement(DocumentationMainContent, {
          introspector: createIntrospectorStub(),
          sidebarWidth: 0,
          openStats: jest.fn(),
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

      fireEvent.click(
        screen.getByRole("button", { name: "Open Runtime Shell" })
      );

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent<{
        resourceId: string | null;
      }>;
      expect(event.detail).toEqual({ resourceId: null });
    } finally {
      window.removeEventListener("docs:open-shell", listener);
    }
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
    expect(
      screen.queryByRole("button", { name: "Open Runtime Shell" })
    ).toBeNull();
  });

  it("animates the hero header only while overview is active", () => {
    const { rerender } = render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
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
          {
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 0,
            hasContent: true,
          },
        ],
      })
    );

    expect(document.querySelector(".docs-header--animated")).not.toBeNull();

    window.location.hash = "#tasks";
    fireEvent(window, new HashChangeEvent("hashchange"));

    rerender(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
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
          {
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 0,
            hasContent: true,
          },
        ],
      })
    );

    expect(document.querySelector(".docs-header--animated")).toBeNull();
  });

  it("renders a focused detail view for an element hash instead of the list", () => {
    window.location.hash = "#element-app.tasks.hello";
    elementTableMock.mockClear();

    const taskCardMock = jest.fn(() => null);
    jest.requireMock("./TaskCard").TaskCard = taskCardMock;

    render(
      React.createElement(DocumentationMainContent, {
        introspector: {
          ...createIntrospectorStub(),
          getTask: (id: string) => (id === "app.tasks.hello" ? { id } : null),
        },
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.hello" }],
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
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 1,
            hasContent: true,
          },
        ],
      })
    );

    expect(screen.getByText("Back to Tasks")).toBeTruthy();
    expect(screen.getByText("app.tasks.hello")).toBeTruthy();
    expect(elementTableMock).not.toHaveBeenCalled();
    expect(taskCardMock).toHaveBeenCalledTimes(1);
    expect(taskCardMock.mock.calls[0][0].task).toEqual(
      expect.objectContaining({ id: "app.tasks.hello" })
    );

    fireEvent.click(screen.getByText("Back to Tasks"));
    expect(window.location.hash).toBe("#tasks");
  });

  it.each([
    ["resources", "app.db", "getResource", "./ResourceCard", "ResourceCard"],
    ["events", "app.events.changed", "getEvent", "./EventCard", "EventCard"],
    ["hooks", "app.hooks.onChange", "getHook", "./HookCard", "HookCard"],
    [
      "middlewares",
      "app.middleware.auth",
      "getMiddleware",
      "./MiddlewareCard",
      "MiddlewareCard",
    ],
    ["errors", "app.errors.invalid", "getError", "./ErrorCard", "ErrorCard"],
    [
      "asyncContexts",
      "app.contexts.identity",
      "getAsyncContext",
      "./AsyncContextCard",
      "AsyncContextCard",
    ],
    ["tags", "app.tags.api", "getTag", "./TagCard", "TagCard"],
  ])(
    "resolves %s detail views through the introspector fallback",
    (sectionId, elementId, getter, cardPath, cardName) => {
      window.location.hash = `#element-${elementId}`;
      elementTableMock.mockClear();

      const cardMock = jest.fn(() => null);
      jest.requireMock(cardPath)[cardName] = cardMock;

      const introspector = createIntrospectorStub() as Record<string, any>;
      introspector[getter] = (id: string) => (id === elementId ? { id } : null);

      render(
        React.createElement(DocumentationMainContent, {
          introspector,
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
              id: sectionId,
              label: sectionId,
              icon: "x",
              count: 1,
              hasContent: true,
            },
          ],
        })
      );

      expect(elementTableMock).not.toHaveBeenCalled();
      expect(cardMock).toHaveBeenCalledTimes(1);
    }
  );

  it("falls back to the list when the element hash is unknown", () => {
    window.location.hash = "#element-nope";
    elementTableMock.mockClear();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.hello" }],
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
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 1,
            hasContent: true,
          },
        ],
      })
    );

    // Unknown element ids resolve to the overview section.
    expect(screen.queryByText(/Back to/)).toBeNull();
  });

  it("swaps tab content in place without a hash jump", async () => {
    window.location.hash = "#overview";
    const selectListener = jest.fn();
    window.addEventListener("docs:select-section", selectListener);

    try {
      render(
        React.createElement(DocumentationMainContent, {
          introspector: createIntrospectorStub(),
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
            {
              id: "diagnostics",
              label: "Diagnostics",
              icon: "🔍",
              count: null,
              hasContent: true,
            },
          ],
        })
      );

      const scrollSpy = Element.prototype.scrollIntoView as jest.Mock;
      scrollSpy.mockClear();

      fireEvent.click(screen.getByRole("tab", { name: /Diagnostics/ }));

      // URL stays shareable via replaceState while content swaps in place.
      expect(window.location.hash).toBe("#diagnostics");
      expect(document.querySelector("#diagnostics")).not.toBeNull();
      expect(document.querySelector("#overview")).toBeNull();
      expect(selectListener).toHaveBeenCalledTimes(1);

      // Let the deferred scroll pass (rAF + 80ms timeout) run: tab clicks
      // must not move the viewport.
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(scrollSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("docs:select-section", selectListener);
    }
  });

  it("opens the execute modal for list-level Run/Emit actions", () => {
    window.location.hash = "#events";
    executeModalMock.mockClear();
    shellModalMock.mockClear();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.hello", inputSchema: "{}" }],
        resources: [],
        events: [
          {
            id: "app.events.hello",
            meta: { title: "Hello" },
            payloadSchema: "{}",
          },
        ],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
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

    expect(executeModalMock).not.toHaveBeenCalled();

    // List view has no detail card mounted, so MainContent owns the modal.
    act(() => {
      window.dispatchEvent(
        new CustomEvent("docs:execute-element", {
          detail: { type: "event", id: "app.events.hello" },
        })
      );
    });

    expect(executeModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        title: "Hello",
        schemaString: "{}",
      })
    );
    expect(shellModalMock).not.toHaveBeenCalled();
  });

  it("opens the shell modal for list-level Shell actions", () => {
    window.location.hash = "#resources";
    executeModalMock.mockClear();
    shellModalMock.mockClear();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [],
        resources: [{ id: "app.resources.db" }],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections: [
          {
            id: "resources",
            label: "Resources",
            icon: getDocumentationIcon("resources"),
            count: 1,
            hasContent: true,
          },
        ],
      })
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("docs:execute-element", {
          detail: { type: "resource", id: "app.resources.db" },
        })
      );
    });

    expect(shellModalMock).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: true, resourceId: "app.resources.db" })
    );
    expect(executeModalMock).not.toHaveBeenCalled();
  });

  it("ignores execute actions for unknown ids", () => {
    window.location.hash = "#events";
    executeModalMock.mockClear();
    shellModalMock.mockClear();

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [],
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
            id: "events",
            label: "Events",
            icon: getDocumentationIcon("events"),
            count: 1,
            hasContent: true,
          },
        ],
      })
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("docs:execute-element", {
          detail: { type: "event", id: "app.events.nope" },
        })
      );
    });

    expect(executeModalMock).not.toHaveBeenCalled();
    expect(shellModalMock).not.toHaveBeenCalled();
  });

  it("pages the detail view to neighboring elements with a counter", () => {
    window.location.hash = "#element-app.tasks.two";

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [
          { id: "app.tasks.one" },
          { id: "app.tasks.two" },
          { id: "app.tasks.three" },
        ],
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
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 3,
            hasContent: true,
          },
        ],
      })
    );

    expect(
      screen
        .getByRole("link", { name: "View previous element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.one");
    expect(
      screen
        .getByRole("link", { name: "View next element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.three");
    expect(screen.getByText("2 of 3")).toBeTruthy();
  });

  it("cycles the detail pager from last to first and back", () => {
    const tasks = [{ id: "app.tasks.one" }, { id: "app.tasks.two" }];
    const sections = [
      {
        id: "tasks",
        label: "Tasks",
        icon: getDocumentationIcon("tasks"),
        count: 2,
        hasContent: true,
      },
    ];

    window.location.hash = "#element-app.tasks.two";
    const { unmount } = render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks,
        resources: [],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections,
      })
    );
    expect(
      screen
        .getByRole("link", { name: "View next element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.one");
    unmount();

    window.location.hash = "#element-app.tasks.one";
    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks,
        resources: [],
        events: [],
        hooks: [],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        topologyConnections: 0,
        sections,
      })
    );
    expect(
      screen
        .getByRole("link", { name: "View previous element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.two");
  });

  it("pages a filtered-out detail to the list edges without a counter", () => {
    window.location.hash = "#element-app.tasks.hidden";

    render(
      React.createElement(DocumentationMainContent, {
        introspector: {
          ...createIntrospectorStub(),
          getTask: (id: string) => (id === "app.tasks.hidden" ? { id } : null),
        },
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.one" }, { id: "app.tasks.two" }],
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
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 2,
            hasContent: true,
          },
        ],
      })
    );

    expect(
      screen
        .getByRole("link", { name: "View previous element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.two");
    expect(
      screen
        .getByRole("link", { name: "View next element" })
        .getAttribute("href")
    ).toBe("#element-app.tasks.one");
    expect(screen.queryByText(/of 2/)).toBeNull();
  });

  it("jumps to the top of the detail card when paging", () => {
    window.location.hash = "#element-app.tasks.one";

    render(
      React.createElement(DocumentationMainContent, {
        introspector: createIntrospectorStub(),
        sidebarWidth: 0,
        tasks: [{ id: "app.tasks.one" }, { id: "app.tasks.two" }],
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
            id: "tasks",
            label: "Tasks",
            icon: getDocumentationIcon("tasks"),
            count: 2,
            hasContent: true,
          },
        ],
      })
    );

    const scrollSpy = Element.prototype.scrollIntoView as jest.Mock;
    scrollSpy.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "View next element" }));

    // (jsdom never navigates on anchor clicks; the href targets are
    // covered above and the real jump is verified in the browser.)
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: "instant",
      block: "start",
    });
    expect(scrollSpy.mock.instances[0]).toBe(
      document.querySelector(".docs-detail")
    );
  });
});
