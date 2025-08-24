import React from "react";
import { TreeView } from "./TreeView";
import { TreeNode } from "../utils/tree-utils";
import { ViewMode, TreeType } from "../hooks/useViewMode";

export interface DocumentationSidebarProps {
  sidebarWidth: number;
  sidebarRef: React.RefObject<HTMLElement>;
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
}

export const DocumentationSidebar: React.FC<DocumentationSidebarProps> = ({
  sidebarWidth,
  sidebarRef,
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
}) => {
  return (
    <nav
      ref={sidebarRef}
      className="docs-sidebar"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="docs-nav-header">
        <h2>📚 Documentation</h2>
        <p>Navigate through your application components</p>
      </div>

      {/* View Mode Toggle */}
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

      {/* Namespace Prefix Input */}
      <div className="docs-namespace-input">
        <label htmlFor="namespace-input">
          {viewMode === "tree" ? "Search Tree" : "Filter by Namespace"}
        </label>
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
        <div
          className="docs-toggle-row"
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
      </div>

      {/* Navigation Content */}
      {viewMode === "list" ? (
        <ul className="docs-nav-list">
          <li>
            <a href="#top" className="docs-nav-link docs-nav-link--home">
              <div className="docs-nav-content">
                <span className="icon">🏠</span>
                <span className="text">Home</span>
              </div>
            </a>
          </li>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="docs-nav-link">
                <div className="docs-nav-content">
                  <span className="icon">{section.icon}</span>
                  <span className="text">{section.label}</span>
                </div>
                {section.count !== null && (
                  <span className="docs-nav-badge">{section.count}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="docs-tree-container">
          <TreeView
            nodes={treeNodes}
            onNodeClick={onTreeNodeClick}
            onToggleExpansion={onToggleExpansion}
            searchTerm={localNamespaceSearch}
            className="docs-tree-view"
          />
        </div>
      )}

      <div className="docs-nav-stats">
        <div className="label">Quick Stats</div>
        <div className="value">{totalComponents}</div>
        <div className="description">Total Components</div>
      </div>
    </nav>
  );
};