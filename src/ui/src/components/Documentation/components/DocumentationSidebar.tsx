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
  showRunner: boolean;
  showPrivate: boolean;
  treeNodes: TreeNode[];
  sections: Array<{
    id: string;
    label: string;
    icon: string;
    count: number | null;
    hasContent: boolean;
  }>;
  onViewModeChange: (mode: ViewMode) => void;
  onTreeTypeChange: (type: TreeType) => void;
  onNamespaceSearchChange: (value: string) => void;
  onShowSystemChange: (value: boolean) => void;
  onShowRunnerChange: (value: boolean) => void;
  onShowPrivateChange: (value: boolean) => void;
  onTreeNodeClick: (node: TreeNode) => void;
  onToggleExpansion: (nodeId: string, expanded?: boolean) => void;
  onSectionClick: (sectionId: string) => void;
  resolveSectionFromElementId?: (elementId: string) => string | null;
}

export const DocumentationSidebar: React.FC<DocumentationSidebarProps> = ({
  sidebarWidth,
  sidebarRef,
  isChatOpen: _isChatOpen,
  onToggleChat: _onToggleChat,
  leftOffset = 0,
  isDarkMode: _isDarkMode = true,
  onToggleDarkMode: _onToggleDarkMode,
  viewMode,
  treeType,
  localNamespaceSearch,
  showSystem,
  showRunner,
  showPrivate,
  treeNodes,
  sections,
  onViewModeChange,
  onTreeTypeChange,
  onNamespaceSearchChange,
  onShowSystemChange,
  onShowRunnerChange,
  onShowPrivateChange,
  onTreeNodeClick,
  onToggleExpansion,
  onSectionClick,
  resolveSectionFromElementId,
}) => {
  const navigationSections = React.useMemo(
    () => sections.filter((section) => section.id !== "topology"),
    [sections]
  );
  const namespaceInputRef = React.useRef<HTMLInputElement>(null);
  const hasNamespaceFilter = localNamespaceSearch.trim().length > 0;

  const handleNamespaceFilterClear = React.useCallback(() => {
    onNamespaceSearchChange("");
    namespaceInputRef.current?.focus();
  }, [onNamespaceSearchChange]);

  const handleNamespaceInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();

      if (e.key === "Escape" && hasNamespaceFilter) {
        e.preventDefault();
        handleNamespaceFilterClear();
      }
    },
    [handleNamespaceFilterClear, hasNamespaceFilter]
  );

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
            {/* [AI-CHAT-DISABLED] AI chat toggle button
            <button
              className={`sidebar-header__action-btn ${
                isChatOpen ? "active" : ""
              }`}
              title={isChatOpen ? "Hide Chat" : "Show Chat"}
              onClick={onToggleChat}
            >
              AI
            </button>
            */}
          </div>
        }
      />

      {/* Main Filters */}
      <div className="docs-main-filters">
        <div
          className={`docs-namespace-input ${
            hasNamespaceFilter ? "docs-namespace-input--active" : ""
          }`}
        >
          <label htmlFor="namespace-input">
            <span className="docs-label-text">Filter by ID</span>
            <Tooltip
              content={
                <div>
                  <div className="tooltip-title">Search Syntax</div>
                  <ul className="tooltip-content">
                    <li>
                      <span className="keyword">Comma for AND:</span>{" "}
                      <span className="example">task,resource</span> (items with
                      both task AND resource)
                    </li>
                    <li>
                      <span className="keyword">Pipe for OR:</span>{" "}
                      <span className="example">task|resource</span> (items with
                      task OR resource)
                    </li>
                    <li>
                      <span className="keyword">Exclude with !:</span>{" "}
                      <span className="example">api,!test</span> (items with api
                      but NOT test)
                    </li>
                    <li>
                      <span className="keyword">Wildcard with *:</span>{" "}
                      <span className="example">app.*.create</span> (namespace
                      wildcard matching)
                    </li>
                    <li>
                      <span className="keyword">Tags search:</span>{" "}
                      <span className="example">:api,debug</span> (search tags
                      for api AND debug)
                    </li>
                  </ul>
                </div>
              }
              position="right"
              delay={200}
            >
              <button
                type="button"
                className="docs-filter-help"
                aria-label="Filter syntax help"
                onClick={(event) => event.preventDefault()}
              >
                ?
              </button>
            </Tooltip>
          </label>
          <div className="docs-namespace-input__field">
            {hasNamespaceFilter && (
              <button
                type="button"
                className="docs-namespace-input__clear"
                aria-label="Clear ID filter"
                onClick={handleNamespaceFilterClear}
              >
                x
              </button>
            )}
            <input
              ref={namespaceInputRef}
              id="namespace-input"
              type="text"
              placeholder={"Filter by ID..."}
              value={localNamespaceSearch}
              onChange={(e) => onNamespaceSearchChange(e.target.value)}
              onKeyDown={handleNamespaceInputKeyDown}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
      <div className="docs-visibility-toggles">
        <div
          className="docs-visibility-toggle-row"
          title="Toggle visibility of system namespace elements"
        >
          <label className="docs-switch" htmlFor="show-system-toggle">
            <span className="docs-switch-copy">
              <span className="docs-switch-text">
                <span className="system-label">SYSTEM</span>
              </span>
              <Tooltip
                content="Show elements from the system root namespace such as system.events.* and system.hooks.*."
                position="right"
                delay={200}
              >
                <button
                  type="button"
                  className="docs-filter-help"
                  aria-label="SYSTEM visibility help"
                  onClick={(event) => event.preventDefault()}
                >
                  ?
                </button>
              </Tooltip>
            </span>
            <span className="docs-switch-control">
              <input
                id="show-system-toggle"
                className="docs-switch-input"
                type="checkbox"
                aria-label="SYSTEM"
                checked={showSystem}
                onChange={(e) => onShowSystemChange(e.target.checked)}
              />
              <span className="docs-switch-track">
                <span className="docs-switch-thumb" />
              </span>
            </span>
          </label>
        </div>
        <div
          className="docs-visibility-toggle-row"
          title="Toggle visibility of runner namespace elements"
        >
          <label className="docs-switch" htmlFor="show-runner-toggle">
            <span className="docs-switch-copy">
              <span className="docs-switch-text">
                <span className="runner-label">RUNNER</span>
              </span>
              <Tooltip
                content="Show elements from the runner root namespace such as runner.logger, runner.tags.*, and other built-in Runner surfaces."
                position="right"
                delay={200}
              >
                <button
                  type="button"
                  className="docs-filter-help"
                  aria-label="RUNNER visibility help"
                  onClick={(event) => event.preventDefault()}
                >
                  ?
                </button>
              </Tooltip>
            </span>
            <span className="docs-switch-control">
              <input
                id="show-runner-toggle"
                className="docs-switch-input"
                type="checkbox"
                aria-label="RUNNER"
                checked={showRunner}
                onChange={(e) => onShowRunnerChange(e.target.checked)}
              />
              <span className="docs-switch-track">
                <span className="docs-switch-thumb" />
              </span>
            </span>
          </label>
        </div>
        <div
          className="docs-visibility-toggle-row"
          title="Toggle visibility of private elements"
        >
          <label className="docs-switch" htmlFor="show-private-toggle">
            <span className="docs-switch-copy">
              <span className="docs-switch-text">
                <span className="private-label">PRIVATE</span>
              </span>
              <Tooltip
                content="Show private elements that belong to the current root application, including private tasks, resources, hooks, and tags."
                position="right"
                delay={200}
              >
                <button
                  type="button"
                  className="docs-filter-help"
                  aria-label="PRIVATE visibility help"
                  onClick={(event) => event.preventDefault()}
                >
                  ?
                </button>
              </Tooltip>
            </span>
            <span className="docs-switch-control">
              <input
                id="show-private-toggle"
                className="docs-switch-input"
                type="checkbox"
                aria-label="PRIVATE"
                checked={showPrivate}
                onChange={(e) => onShowPrivateChange(e.target.checked)}
              />
              <span className="docs-switch-track">
                <span className="docs-switch-thumb" />
              </span>
            </span>
          </label>
        </div>
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
          treeType={treeType}
          nodes={treeNodes}
          sections={navigationSections}
          onNodeClick={onTreeNodeClick}
          onSectionClick={onSectionClick}
          onToggleExpansion={onToggleExpansion}
          resolveSectionFromElementId={resolveSectionFromElementId}
          searchTerm={localNamespaceSearch}
          className="docs-navigation"
        />
      </div>

      {/* Docs & Support Section */}
      <div className="docs-support-section">
        <div className="docs-support-title">Docs & Support</div>

        <a
          href="#docs-support"
          className="docs-support-link docs-support-link--docs"
        >
          <span className="docs-support-icon">📚</span>
          <span className="docs-support-text">Docs</span>
          <span className="docs-support-arrow">→</span>
        </a>
      </div>
    </nav>
  );
};
