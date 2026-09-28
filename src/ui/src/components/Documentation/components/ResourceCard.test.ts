/** @jest-environment jsdom */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Middleware, Resource } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { ResourceCard } from "./ResourceCard";
import { DocumentationModeProvider } from "../context/DocumentationModeContext";

const mockResourceIsolationSection = jest.fn(() => null);
const mockShellModal = jest.fn((_props: unknown) => null);

jest.mock("./ResourceCard.scss", () => ({}), { virtual: true });
jest.mock("./common/DependenciesSection.scss", () => ({}), { virtual: true });
jest.mock("./common/RegisteredByInfoBlock.scss", () => ({}), {
  virtual: true,
});

jest.mock("./CodeModal", () => ({
  CodeModal: () => null,
}));

jest.mock("./TagsSection", () => ({
  TagsSection: () => null,
}));

jest.mock("./SchemaRenderer", () => ({
  SchemaRenderer: () => null,
}));

jest.mock("./common/DependenciesSection", () => ({
  DependenciesSection: () => null,
}));

jest.mock("./ResourceIsolationSection", () => ({
  ResourceIsolationSection: (props: unknown) =>
    mockResourceIsolationSection(props),
}));

jest.mock("./ResourceSubtreeSection", () => ({
  ResourceSubtreeSection: () => null,
}));

jest.mock("./ResourceEventLanesSection", () => ({
  ResourceEventLanesSection: () => null,
}));

jest.mock("./ResourceRpcLanesSection", () => ({
  ResourceRpcLanesSection: () => null,
}));

jest.mock("./common/SearchableList", () => ({
  SearchableList: () => null,
}));

jest.mock("./modals", () => ({
  BaseModal: () => null,
}));

jest.mock("./TopologyActionButton", () => ({
  TopologyActionButton: () => null,
}));

jest.mock("./ShellModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockShellModal(props),
}));

jest.mock("./common/ElementCard", () => ({
  ElementCard: ({
    children,
    title,
    meta,
    actions,
    className,
    headerClassName,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    headerClassName?: string;
  }) =>
    React.createElement(
      "section",
      { "data-testid": "element-card", className },
      React.createElement(
        "div",
        { "data-testid": "element-card-header", className: headerClassName },
        React.createElement("h3", null, title),
        meta,
        actions
          ? React.createElement(
              "div",
              { "data-testid": "element-card-actions" },
              actions
            )
          : null
      ),
      children
    ),
  CardSection: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("h4", null, title),
      children
    ),
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

describe("ResourceCard", () => {
  beforeEach(() => {
    mockResourceIsolationSection.mockClear();
    mockShellModal.mockClear();
  });

  it("adds root resource treatment and root ownership copy", () => {
    const resource: Resource = {
      id: "app",
      meta: { title: "Application Shell" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    expect(screen.getByText("Application Root")).toBeTruthy();
    expect(screen.getByText("Root Resource")).toBeTruthy();
    expect(screen.getByText("Root-level registration")).toBeTruthy();
    expect(screen.getByTestId("element-card").className).toContain(
      "resource-card--root"
    );
    expect(screen.getByTestId("element-card-header").className).toContain(
      "resource-card__header--root"
    );
  });

  it("hides coverage drill-down in catalog mode", () => {
    const resource: Resource = {
      id: "app.resources.catalog",
      meta: { title: "Catalog Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: "/tmp/catalog.ts",
      coverage: { percentage: 92 } as any,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(
        DocumentationModeProvider,
        { mode: "catalog" },
        React.createElement(ResourceCard, {
          resource,
          introspector,
        })
      )
    );

    expect(screen.queryByText("(View Coverage)")).toBeNull();
    expect(screen.queryByTitle("View file contents")).toBeNull();
  });

  it("renders a richer lifecycle methods strip including init and dispose", () => {
    const resource: Resource = {
      id: "app.resources.server",
      meta: { title: "Server Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
      hasInit: true,
      hasReady: true,
      hasDispose: true,
      hasHealthCheck: true,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    expect(screen.getByText("Lifecycle Methods:")).toBeTruthy();
    expect(screen.getByText("init")).toBeTruthy();
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByText("dispose")).toBeTruthy();
    expect(screen.getByText("health")).toBeTruthy();
    expect(
      screen.getByText(/Declared resource lifecycle surface detected/i)
    ).toBeTruthy();
  });

  it("shows a calm empty state when no lifecycle methods are declared", () => {
    const resource: Resource = {
      id: "app.resources.simple",
      meta: { title: "Simple Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    expect(
      screen.getByText("No custom lifecycle methods declared.")
    ).toBeTruthy();
  });

  it("passes overview-style adaptive id formatting to isolation exports", () => {
    const resource: Resource = {
      id: "enhanced-app.catalog.isolation-boundary",
      meta: { title: "Isolation Boundary" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: "enhanced-app.catalog",
      filePath: null,
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
    };

    const publicCatalogResource = {
      id: "enhanced-app.catalog.public-catalog",
      registeredBy: "enhanced-app.catalog",
    };
    const catalogSearchTask = {
      id: "enhanced-app.catalog.tasks.catalog-search",
      registeredBy: "enhanced-app.catalog",
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource, publicCatalogResource],
      getRoot: () => resource,
      getTagsByIds: () => [],
      getTask: (id: string) =>
        id === catalogSearchTask.id ? catalogSearchTask : null,
      getHook: () => null,
      getResource: (id: string) => {
        if (id === resource.id) return resource;
        if (id === publicCatalogResource.id) return publicCatalogResource;
        return null;
      },
      getEvent: () => null,
      getMiddleware: () => null,
      getError: () => null,
      getAsyncContext: () => null,
      getTag: () => null,
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    const props = mockResourceIsolationSection.mock.calls[0]?.[0] as
      | {
          resolveReferenceElement?: (id: string) => {
            id: string;
            registeredBy?: string | null;
          };
          resources?: Array<{ id: string; registeredBy?: string | null }>;
        }
      | undefined;

    expect(props?.resolveReferenceElement?.(publicCatalogResource.id)).toEqual(
      publicCatalogResource
    );
    expect(props?.resolveReferenceElement?.(catalogSearchTask.id)).toEqual(
      catalogSearchTask
    );
    expect(props?.resources).toEqual([resource, publicCatalogResource]);
  });

  it("opens the shell modal from the Shell action in live mode", () => {
    const resource: Resource = {
      id: "app.resources.db",
      meta: { title: "DB Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    const shellButton = screen.getByRole("button", { name: "Shell" });
    expect(shellButton).toBeTruthy();
    expect(mockShellModal).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: false, resourceId: resource.id })
    );

    fireEvent.click(shellButton);
    expect(mockShellModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, resourceId: resource.id })
    );
  });

  it("opens the shell modal on docs:execute-element for its resource", () => {
    const resource: Resource = {
      id: "app.resources.cache",
      meta: { title: "Cache Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("docs:execute-element", {
          detail: { type: "resource", id: resource.id },
        })
      );
    });

    expect(mockShellModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, resourceId: resource.id })
    );
  });

  it("hides the Shell action in catalog mode", () => {
    const resource: Resource = {
      id: "app.resources.catalog",
      meta: { title: "Catalog Resource" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(
        DocumentationModeProvider,
        { mode: "catalog" },
        React.createElement(ResourceCard, {
          resource,
          introspector,
        })
      )
    );

    expect(screen.queryByRole("button", { name: "Shell" })).toBeNull();
    expect(mockShellModal).not.toHaveBeenCalled();
  });
  it("shows subtree provenance for resource middleware like task cards do", () => {
    const resourceMiddleware = (id: string, title: string): Middleware => ({
      id,
      meta: { title },
      type: "resource",
      autoApply: { enabled: false, scope: null, hasPredicate: false },
      usedByTasks: [],
      usedByResources: ["app.features.db"],
    });
    const resource = (id: string, overrides: Partial<Resource>): Resource => ({
      id,
      emits: [],
      dependsOn: [],
      middleware: [],
      overrides: [],
      registers: [],
      ...overrides,
    });
    const db = resource("app.features.db", {
      meta: { title: "Database" },
      registeredBy: "app.features",
      middleware: ["app.mw.retry", "app.mw.audit"],
      middlewareDetailed: [
        {
          id: "app.mw.retry",
          config: null,
          origin: "subtree",
          subtreeOwnerId: "app.features",
        },
        {
          id: "app.mw.audit",
          config: JSON.stringify({ level: "info" }),
          origin: "local",
          subtreeOwnerId: null,
        },
      ],
    });
    const introspector = new Introspector({
      data: {
        tasks: [],
        hooks: [],
        resources: [
          resource("app", { registers: ["app.features"] }),
          resource("app.features", {
            registeredBy: "app",
            registers: ["app.features.db"],
          }),
          db,
        ],
        events: [],
        middlewares: [
          resourceMiddleware("app.mw.retry", "Retry"),
          resourceMiddleware("app.mw.audit", "Audit"),
        ],
        tags: [],
        rootId: "app",
      },
    });

    render(
      React.createElement(ResourceCard, {
        resource: db,
        introspector,
      })
    );

    const badge = screen.getByText("Subtree Policy");
    expect(screen.getAllByText("Subtree Policy")).toHaveLength(1);
    expect(badge.getAttribute("title")).toBe(
      "Applied by subtree policy from app.features"
    );
    expect(badge.parentElement?.textContent).toContain("Retry");
    expect(
      screen
        .getByText(/Source:/)
        .querySelector("a")
        ?.getAttribute("href")
    ).toBe("#element-app.features");
    expect(screen.getByText("Audit")).toBeTruthy();
    expect(screen.getByText(/"level"/)).toBeTruthy();
  });
});
