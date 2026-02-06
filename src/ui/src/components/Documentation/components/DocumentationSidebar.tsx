import React from "react";
import { NavigationView } from "./NavigationView";
import { TreeNode } from "../utils/tree-utils";
import { ViewMode, TreeType } from "../hooks/useViewMode";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { Tooltip } from "./Tooltip";

export interface DocumentationSidebarProps {
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  leftOffset?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
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
  isDarkMode = true,
  onToggleDarkMode,
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
        title="Runner Dev"
        className="sidebar-header--docs"
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className={`sidebar-header__action-btn ${
                isChatOpen ? "active" : ""
              }`}
              title={isChatOpen ? "Hide Chat" : "Show Chat"}
              onClick={onToggleChat}
            >
              AI
            </button>
          </div>
        }
      />

      {/* Main Filters */}
      <div className="docs-main-filters">
        <div className="docs-namespace-input">
          <label htmlFor="namespace-input">
            <span className="docs-label-text">Filter by ID</span>
            <Tooltip
              content={
                <div>
                  <div className="tooltip-title">Search Syntax</div>
                  <ul className="tooltip-content">
                    <li><span className="keyword">Comma for AND:</span> <span className="example">task,resource</span> (items with both task AND resource)</li>
                    <li><span className="keyword">Pipe for OR:</span> <span className="example">task|resource</span> (items with task OR resource)</li>
                    <li><span className="keyword">Exclude with !:</span> <span className="example">api,!test</span> (items with api but NOT test)</li>
                    <li><span className="keyword">Tags search:</span> <span className="example">:api,debug</span> (search tags for api AND debug)</li>
                  </ul>
                </div>
              }
              position="right"
              delay={200}
            >
              <span className="docs-filter-help">?</span>
            </Tooltip>
          </label>
          <input
            id="namespace-input"
            type="text"
            placeholder={"Filter by ID..."}
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
          <span className="docs-switch-text">
            <span className="system-label">SYSTEM</span>
          </span>
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
            <span className="icon">📄</span>
            <span className="label">List</span>
          </button>
          <button
            className={`docs-view-button ${
              viewMode === "tree" ? "active" : ""
            }`}
            onClick={() => onViewModeChange("tree")}
            title="Tree View"
          >
            <span className="icon">🌳</span>
            <span className="label">Tree</span>
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
              <span className="icon">📁</span>
              <span className="label">Namespace</span>
            </button>
            <button
              className={`docs-view-button ${
                treeType === "type" ? "active" : ""
              }`}
              onClick={() => onTreeTypeChange("type")}
              title="By Type"
            >
              <span className="icon">🏷️</span>
              <span className="label">Type</span>
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

      {/* Help & Support Section */}
      <div className="docs-support-section">
        <div className="docs-support-title">Help & Support</div>

        <a
          href="https://github.com/bluelibs/runner/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="docs-support-link docs-support-link--issue"
        >
          <span className="docs-support-icon">🐛</span>
          <span className="docs-support-text">Submit an Issue</span>
          <span className="docs-support-arrow">→</span>
        </a>

        <a
          href="mailto:theodor@bluelibs.com"
          className="docs-support-link docs-support-link--contact"
        >
          <span className="docs-support-icon">💬</span>
          <span className="docs-support-text">Contact Creator</span>
          <span className="docs-support-arrow">→</span>
        </a>
      </div>
    </nav>
  );
};
