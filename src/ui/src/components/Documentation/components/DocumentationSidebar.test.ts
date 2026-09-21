/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentationSidebar } from "./DocumentationSidebar";

const mockNavigationView = jest.fn(() => null);

jest.mock("./NavigationView", () => ({
  NavigationView: (props: unknown) => mockNavigationView(props),
}));

jest.mock("./sidebar/SidebarHeader", () => ({
  SidebarHeader: ({ title }: { title: string }) => title,
}));

describe("DocumentationSidebar visibility filters", () => {
  beforeEach(() => {
    mockNavigationView.mockClear();
  });

  const renderSidebar = (props: Record<string, unknown> = {}) =>
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        showSystem: false,
        showRunner: false,
        showPrivate: false,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
        ...props,
      })
    );

  it("opens a popover with Framework, System, and Private checkboxes", () => {
    renderSidebar();

    expect(screen.queryByText("Show Framework")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visibility filters" }));

    expect(screen.getByText("Show Framework")).toBeTruthy();
    expect(screen.getByText("Show System")).toBeTruthy();
    expect(screen.getByText("Show Private Components")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("calls filter handlers when the popover checkboxes are changed", () => {
    const onShowSystemChange = jest.fn();
    const onShowRunnerChange = jest.fn();
    const onShowPrivateChange = jest.fn();

    renderSidebar({
      showSystem: false,
      showRunner: true,
      showPrivate: false,
      onShowSystemChange,
      onShowRunnerChange,
      onShowPrivateChange,
    });
    fireEvent.click(screen.getByRole("button", { name: "Visibility filters" }));

    const frameworkToggle = screen.getByRole("checkbox", {
      name: /Show Framework/,
    });
    const systemToggle = screen.getByRole("checkbox", {
      name: /Show System/,
    });
    const privateToggle = screen.getByRole("checkbox", {
      name: /Show Private Components/,
    });

    fireEvent.click(frameworkToggle);
    fireEvent.click(systemToggle);
    fireEvent.click(privateToggle);

    expect(onShowRunnerChange).toHaveBeenCalledWith(false);
    expect(onShowSystemChange).toHaveBeenCalledWith(true);
    expect(onShowPrivateChange).toHaveBeenCalledWith(true);
  });

  it("closes the popover on Escape", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Visibility filters" }));
    expect(screen.getByText("Show Framework")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Show Framework")).toBeNull();
  });

  it("closes the popover on outside pointer down", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Visibility filters" }));
    expect(screen.getByText("Show Framework")).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Show Framework")).toBeNull();
  });

  it("renders docs and support actions", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    expect(screen.getByText("Docs & Support")).toBeTruthy();
    expect(screen.getByText("Docs")).toBeTruthy();
  });

  it("keeps topology out of the left navigation list", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [
          {
            id: "overview",
            label: "Overview",
            icon: "O",
            count: null,
            hasContent: true,
          },
          {
            id: "topology",
            label: "Topology",
            icon: "T",
            count: 3,
            hasContent: true,
          },
          {
            id: "tasks",
            label: "Tasks",
            icon: "K",
            count: 2,
            hasContent: true,
          },
        ],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    expect(mockNavigationView).toHaveBeenCalled();
    const navigationProps = mockNavigationView.mock.calls[0][0] as {
      sections: Array<{ id: string }>;
    };

    expect(navigationProps.sections.map((section) => section.id)).toEqual([
      "overview",
      "tasks",
    ]);
  });

  it("opens the palette from the search trigger", () => {
    const onOpenPalette = jest.fn();
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
        onOpenPalette,
        onOpenShortcuts: () => {},
      })
    );

    fireEvent.click(screen.getByTitle(/⌘K/));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  it("opens shortcuts help and toggles the theme from the footer", () => {
    const onOpenShortcuts = jest.fn();
    const onToggleDarkMode = jest.fn();
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        isDarkMode: true,
        onToggleDarkMode,
        viewMode: "list",
        treeType: "namespace",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
        onOpenPalette: () => {},
        onOpenShortcuts,
      })
    );

    fireEvent.click(screen.getByTitle(/keyboard shortcuts/));
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle(/light theme/));
    expect(onToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it("hides the theme toggle when no handler is provided", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
        onOpenPalette: () => {},
        onOpenShortcuts: () => {},
      })
    );

    expect(screen.queryByTitle(/theme/)).toBeNull();
  });

  it("dispatches docs:open-shell when the Shell action is clicked", () => {
    const listener = jest.fn();
    window.addEventListener("docs:open-shell", listener);

    try {
      render(
        React.createElement(DocumentationSidebar, {
          sidebarWidth: 280,
          sidebarRef: React.createRef<HTMLElement>(),
          viewMode: "list",
          treeType: "namespace",
          showSystem: true,
          showRunner: true,
          showPrivate: true,
          treeNodes: [],
          sections: [],
          onViewModeChange: () => {},
          onTreeTypeChange: () => {},
          onShowSystemChange: () => {},
          onShowRunnerChange: () => {},
          onShowPrivateChange: () => {},
          onTreeNodeClick: () => {},
          onToggleExpansion: () => {},
          onSectionClick: () => {},
        })
      );

      fireEvent.click(screen.getByRole("button", { name: /Shell/ }));

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CustomEvent<{
        resourceId: string | null;
      }>;
      expect(event.detail).toEqual({ resourceId: null });
    } finally {
      window.removeEventListener("docs:open-shell", listener);
    }
  });
});
