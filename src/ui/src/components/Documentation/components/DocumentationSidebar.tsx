import React from "react";
import { NavigationView } from "./NavigationView";
import { TreeNode } from "../utils/tree-utils";
import { ViewMode, TreeType } from "../hooks/useViewMode";
import { SidebarHeader } from "./sidebar/SidebarHeader";

export interface DocumentationSidebarProps {
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  leftOffset?: number;
  viewMode: ViewMode;
  treeType: TreeType;
  localNamespaceSearch: string;
  showSystem: boolean;
  treeNodes: TreeNode[];
  sections: Array<{
    id: string;
    label: string;
    icon: string;
    count: number | null;
    hasContent: boolean;
  }>;
  totalComponents: number;
  onViewModeChange: (mode: ViewMode) => void;
  onTreeTypeChange: (type: TreeType) => void;
  onNamespaceSearchChange: (value: string) => void;
  onShowSystemChange: (value: boolean) => void;
  onTreeNodeClick: (node: TreeNode) => void;
  onToggleExpansion: (nodeId: string, expanded?: boolean) => void;
  onSectionClick: (sectionId: string) => void;
}

export const DocumentationSidebar: React.FC<DocumentationSidebarProps> = ({
  sidebarWidth,
  sidebarRef,
  isChatOpen,
  onToggleChat,
  leftOffset = 0,
  viewMode,
  treeType,
  localNamespaceSearch,
  showSystem,
  treeNodes,
  sections,
  totalComponents,
  onViewModeChange,
  onTreeTypeChange,
  onNamespaceSearchChange,
  onShowSystemChange,
  onTreeNodeClick,
  onToggleExpansion,
  onSectionClick,
}) => {
  return (
    <nav
      ref={sidebarRef}
      className="docs-sidebar"
      style={{ width: `${sidebarWidth}px`, left: `${leftOffset}px` }}
    >
      <SidebarHeader
        icon="📚"
        title="Documentation"
        className="sidebar-header--docs"
        actions={
          <button
            className={`sidebar-header__action-btn ${
              isChatOpen ? "active" : ""
            }`}
            title={isChatOpen ? "Hide Chat" : "Show Chat"}
            onClick={onToggleChat}
          >
            AI
          </button>
        }
      />

      {/* Main Filters */}
      <div className="docs-main-filters">
        <div className="docs-namespace-input">
          <label htmlFor="namespace-input">Filter by ID</label>
          <input
            id="namespace-input"
            type="text"
            placeholder={
              viewMode === "tree"
                ? "Search elements..."
                : "Enter namespace prefix or any key..."
            }
            value={localNamespaceSearch}
            onChange={(e) => onNamespaceSearchChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div
        className="docs-system-toggle-container"
        title="Toggle visibility of system-tagged elements"
      >
        <label className="docs-switch" htmlFor="show-system-toggle">
          <input
            id="show-system-toggle"
            className="docs-switch-input"
            type="checkbox"
            checked={showSystem}
            onChange={(e) => onShowSystemChange(e.target.checked)}
          />
          <span className="docs-switch-track">
            <span className="docs-switch-thumb" />
          </span>
          <span className="docs-switch-text">Show System</span>
        </label>
      </div>

      {/* View Mode Controls */}
      <div className="docs-view-controls">
        <div className="docs-view-toggle">
          <button
            className={`docs-view-button ${
              viewMode === "list" ? "active" : ""
            }`}
            onClick={() => onViewModeChange("list")}
            title="List View"
          >
            📄 List
          </button>
          <button
            className={`docs-view-button ${
              viewMode === "tree" ? "active" : ""
            }`}
            onClick={() => onViewModeChange("tree")}
            title="Tree View"
          >
            🌳 Tree
          </button>
        </div>
        {viewMode === "tree" && (
          <div className="docs-view-toggle">
            <button
              className={`docs-view-button ${
                treeType === "namespace" ? "active" : ""
              }`}
              onClick={() => onTreeTypeChange("namespace")}
              title="By Namespace"
            >
              📁 Namespace
            </button>
            <button
              className={`docs-view-button ${
                treeType === "type" ? "active" : ""
              }`}
              onClick={() => onTreeTypeChange("type")}
              title="By Type"
            >
              🏷️ Type
            </button>
          </div>
        )}
      </div>

      {/* Navigation Content */}
      <div className="docs-nav-container">
        <NavigationView
          mode={viewMode}
          nodes={treeNodes}
          sections={sections}
          onNodeClick={onTreeNodeClick}
          onSectionClick={onSectionClick}
          onToggleExpansion={onToggleExpansion}
          searchTerm={localNamespaceSearch}
          className="docs-navigation"
        />
      </div>

      <div className="docs-nav-stats">
        <div className="label">Quick Stats</div>
        <div className="value">{totalComponents}</div>
        <div className="description">Total Components</div>
      </div>
    </nav>
  );
};
