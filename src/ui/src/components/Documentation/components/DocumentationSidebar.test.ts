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

jest.mock("./Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

describe("DocumentationSidebar visibility toggles", () => {
  beforeEach(() => {
    mockNavigationView.mockClear();
  });

  it("renders SYSTEM, RUNNER, and PRIVATE toggles in compact rows", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange: () => {},
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    expect(screen.getByText("SYSTEM")).toBeTruthy();
    expect(screen.getByText("RUNNER")).toBeTruthy();
    expect(screen.getByText("PRIVATE")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("calls toggle handlers when SYSTEM, RUNNER, and PRIVATE are changed", () => {
    const onShowSystemChange = jest.fn();
    const onShowRunnerChange = jest.fn();
    const onShowPrivateChange = jest.fn();

    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: false,
        showRunner: true,
        showPrivate: false,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange: () => {},
        onShowSystemChange,
        onShowRunnerChange,
        onShowPrivateChange,
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    const systemToggle = screen.getByRole("checkbox", { name: "SYSTEM" });
    const runnerToggle = screen.getByRole("checkbox", { name: "RUNNER" });
    const privateToggle = screen.getByRole("checkbox", { name: "PRIVATE" });

    fireEvent.click(systemToggle);
    fireEvent.click(runnerToggle);
    fireEvent.click(privateToggle);

    expect(onShowSystemChange).toHaveBeenCalledWith(true);
    expect(onShowRunnerChange).toHaveBeenCalledWith(false);
    expect(onShowPrivateChange).toHaveBeenCalledWith(true);
  });

  it("renders docs and support actions", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange: () => {},
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
        localNamespaceSearch: "",
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
        onNamespaceSearchChange: () => {},
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

  it("shows a clear button only while the ID filter has content", () => {
    const onNamespaceSearchChange = jest.fn();

    const { rerender } = render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange,
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    expect(screen.queryByLabelText("Clear ID filter")).toBeNull();

    rerender(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "task.user",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange,
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    fireEvent.click(screen.getByLabelText("Clear ID filter"));

    expect(onNamespaceSearchChange).toHaveBeenCalledWith("");
  });

  it("clears the ID filter when Escape is pressed while the input is focused", () => {
    const onNamespaceSearchChange = jest.fn();

    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "task.user",
        showSystem: true,
        showRunner: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange,
        onShowSystemChange: () => {},
        onShowRunnerChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    const input = screen.getByPlaceholderText("Filter by ID...");
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onNamespaceSearchChange).toHaveBeenCalledWith("");
  });
});
