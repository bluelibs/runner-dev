/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentationSidebar } from "./DocumentationSidebar";

jest.mock("./NavigationView", () => ({
  NavigationView: () => null,
}));

jest.mock("./sidebar/SidebarHeader", () => ({
  SidebarHeader: ({ title }: { title: string }) => title,
}));

jest.mock("./Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));

describe("DocumentationSidebar visibility toggles", () => {
  it("renders SYSTEM and PRIVATE toggles in two rows", () => {
    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: true,
        showPrivate: true,
        treeNodes: [],
        sections: [],
        totalComponents: 0,
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange: () => {},
        onShowSystemChange: () => {},
        onShowPrivateChange: () => {},
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    expect(screen.getByText("SYSTEM")).toBeTruthy();
    expect(screen.getByText("PRIVATE")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("calls toggle handlers when SYSTEM and PRIVATE are changed", () => {
    const onShowSystemChange = jest.fn();
    const onShowPrivateChange = jest.fn();

    render(
      React.createElement(DocumentationSidebar, {
        sidebarWidth: 280,
        sidebarRef: React.createRef<HTMLElement>(),
        viewMode: "list",
        treeType: "namespace",
        localNamespaceSearch: "",
        showSystem: false,
        showPrivate: false,
        treeNodes: [],
        sections: [],
        totalComponents: 0,
        onViewModeChange: () => {},
        onTreeTypeChange: () => {},
        onNamespaceSearchChange: () => {},
        onShowSystemChange,
        onShowPrivateChange,
        onTreeNodeClick: () => {},
        onToggleExpansion: () => {},
        onSectionClick: () => {},
      })
    );

    const systemToggle = screen.getByLabelText("SYSTEM");
    const privateToggle = screen.getByLabelText("PRIVATE");

    fireEvent.click(systemToggle);
    fireEvent.click(privateToggle);

    expect(onShowSystemChange).toHaveBeenCalledWith(true);
    expect(onShowPrivateChange).toHaveBeenCalledWith(true);
  });
});
