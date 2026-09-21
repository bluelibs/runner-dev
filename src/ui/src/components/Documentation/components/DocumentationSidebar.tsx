import React from "react";
import { createPortal } from "react-dom";
import { NavigationView } from "./NavigationView";
import { TreeNode } from "../utils/tree-utils";
import { ViewMode, TreeType } from "../hooks/useViewMode";
import { DocIcon } from "./common/DocIcon";
import { useIsCatalogDocumentation } from "../context/DocumentationModeContext";

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
  /** Highlights matching tree labels when the docs are pre-filtered by namespace. */
  searchTerm?: string;
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
  onShowSystemChange: (value: boolean) => void;
  onShowRunnerChange: (value: boolean) => void;
  onShowPrivateChange: (value: boolean) => void;
  onTreeNodeClick: (node: TreeNode) => void;
  onToggleExpansion: (nodeId: string, expanded?: boolean) => void;
  onSectionClick: (sectionId: string) => void;
  resolveSectionFromElementId?: (elementId: string) => string | null;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}

export const DocumentationSidebar: React.FC<DocumentationSidebarProps> = ({
  sidebarWidth,
  sidebarRef,
  isChatOpen: _isChatOpen,
  onToggleChat: _onToggleChat,
  leftOffset = 0,
  isDarkMode = true,
  onToggleDarkMode,
  viewMode,
  treeType,
  searchTerm = "",
  showSystem,
  showRunner,
  showPrivate,
  treeNodes,
  sections,
  onViewModeChange,
  onTreeTypeChange,
  onShowSystemChange,
  onShowRunnerChange,
  onShowPrivateChange,
  onTreeNodeClick,
  onToggleExpansion,
  onSectionClick,
  resolveSectionFromElementId,
  onOpenPalette,
  onOpenShortcuts,
}) => {
  const isCatalogMode = useIsCatalogDocumentation();
  const navigationSections = React.useMemo(
    () => sections.filter((section) => section.id !== "topology"),
    [sections]
  );

  const handleOpenShell = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("docs:open-shell", { detail: { resourceId: null } })
    );
  }, []);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filterPopoverPos, setFilterPopoverPos] = React.useState<{
    left: number;
    top: number;
  } | null>(null);
  const filterAnchorRef = React.useRef<HTMLDivElement>(null);
  const filterPopoverRef = React.useRef<HTMLDivElement>(null);
  const hasVisibilityFilter = showSystem || showRunner || showPrivate;

  const toggleFilters = React.useCallback(() => {
    if (filtersOpen) {
      setFiltersOpen(false);
      return;
    }
    // The sidebar clips horizontal overflow, so the popover is portaled to
    // the body and anchored to the right of the search row.
    const rect = filterAnchorRef.current?.getBoundingClientRect();
    setFilterPopoverPos(
      rect ? { left: rect.right + 8, top: rect.top } : { left: 0, top: 0 }
    );
    setFiltersOpen(true);
  }, [filtersOpen]);

  React.useEffect(() => {
    if (!filtersOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !filterAnchorRef.current?.contains(target) &&
        !filterPopoverRef.current?.contains(target)
      ) {
        setFiltersOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    const handleScroll = () => setFiltersOpen(false);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [filtersOpen]);

  return (
    <nav
      ref={sidebarRef}
      className="docs-sidebar"
      style={{ width: `${sidebarWidth}px`, left: `${leftOffset}px` }}
    >
      {/* Main Filters */}
      <div className="docs-main-filters">
        <div className="docs-search-row" ref={filterAnchorRef}>
          <button
            type="button"
            className="docs-palette-trigger"
            onClick={onOpenPalette}
            title="Search or jump to anything (⌘K)"
          >
            <span className="docs-palette-trigger__icon">
              <DocIcon name="diagnostics" size={14} />
            </span>
            <span className="docs-palette-trigger__text">
              Search or jump to...
            </span>
            <kbd className="docs-kbd">⌘K</kbd>
          </button>
          <button
            type="button"
            className={`docs-filter-button${
              hasVisibilityFilter ? " docs-filter-button--active" : ""
            }`}
            onClick={toggleFilters}
            aria-expanded={filtersOpen}
            aria-label="Visibility filters"
            title="Visibility filters"
          >
            <DocIcon name="filter" size={14} />
            {hasVisibilityFilter && (
              <span className="docs-filter-button__dot" aria-hidden="true" />
            )}
          </button>
        </div>
        {filtersOpen &&
          filterPopoverPos &&
          createPortal(
            <div
              ref={filterPopoverRef}
              className="docs-filter-popover"
              role="dialog"
              aria-label="Visibility filters"
              style={{
                left: `${filterPopoverPos.left}px`,
                top: `${filterPopoverPos.top}px`,
              }}
            >
              <label className="docs-filter-option">
                <input
                  type="checkbox"
                  checked={showRunner}
                  onChange={(e) => onShowRunnerChange(e.target.checked)}
                />
                <span className="docs-filter-option__copy">
                  <span className="docs-filter-option__label">
                    Show Framework
                  </span>
                  <span className="docs-filter-option__description">
                    Built-in runner.* surfaces like runner.logger
                  </span>
                </span>
              </label>
              <label className="docs-filter-option">
                <input
                  type="checkbox"
                  checked={showSystem}
                  onChange={(e) => onShowSystemChange(e.target.checked)}
                />
                <span className="docs-filter-option__copy">
                  <span className="docs-filter-option__label">Show System</span>
                  <span className="docs-filter-option__description">
                    system.* root namespace elements
                  </span>
                </span>
              </label>
              <label className="docs-filter-option">
                <input
                  type="checkbox"
                  checked={showPrivate}
                  onChange={(e) => onShowPrivateChange(e.target.checked)}
                />
                <span className="docs-filter-option__copy">
                  <span className="docs-filter-option__label">
                    Show Private Components
                  </span>
                  <span className="docs-filter-option__description">
                    Private elements of the current app
                  </span>
                </span>
              </label>
            </div>,
            document.body
          )}
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
            <span className="icon">
              <DocIcon name="list" size={14} />
            </span>
            <span className="label">List</span>
          </button>
          <button
            className={`docs-view-button ${
              viewMode === "tree" ? "active" : ""
            }`}
            onClick={() => onViewModeChange("tree")}
            title="Tree View"
          >
            <span className="icon">
              <DocIcon name="tree" size={14} />
            </span>
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
              <span className="icon">
                <DocIcon name="folder" size={14} />
              </span>
              <span className="label">Namespace</span>
            </button>
            <button
              className={`docs-view-button ${
                treeType === "type" ? "active" : ""
              }`}
              onClick={() => onTreeTypeChange("type")}
              title="By Type"
            >
              <span className="icon">
                <DocIcon name="tag" size={14} />
              </span>
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
          searchTerm={searchTerm}
          className="docs-navigation"
        />
      </div>

      {/* Docs & Support Section */}
      <div className="docs-support-section">
        <div className="docs-support-title">Docs & Support</div>

        {!isCatalogMode && (
          <button
            type="button"
            className="docs-support-link docs-support-link--shell"
            onClick={handleOpenShell}
            title="Open runtime shell (Ctrl+`)"
          >
            <span className="docs-support-icon">
              <DocIcon name="terminal" size={14} />
            </span>
            <span className="docs-support-text">Shell</span>
            <kbd className="docs-kbd">⌃`</kbd>
          </button>
        )}

        <button
          type="button"
          className="docs-support-link docs-support-link--shortcuts"
          onClick={onOpenShortcuts}
          title="Show keyboard shortcuts (?)"
        >
          <span className="docs-support-icon">
            <DocIcon name="command" size={14} />
          </span>
          <span className="docs-support-text">Shortcuts</span>
          <kbd className="docs-kbd">?</kbd>
        </button>

        {onToggleDarkMode && (
          <button
            type="button"
            className="docs-support-link docs-support-link--theme"
            onClick={onToggleDarkMode}
            title={
              isDarkMode ? "Switch to light theme" : "Switch to dark theme"
            }
          >
            <span className="docs-support-icon">
              <DocIcon name={isDarkMode ? "sun" : "moon"} size={14} />
            </span>
            <span className="docs-support-text">
              {isDarkMode ? "Light" : "Dark"}
            </span>
            <span className="docs-support-arrow">→</span>
          </button>
        )}

        <a
          href="#docs-support"
          className="docs-support-link docs-support-link--docs"
        >
          <span className="docs-support-icon">
            <DocIcon name="book" size={14} />
          </span>
          <span className="docs-support-text">Docs</span>
          <span className="docs-support-arrow">→</span>
        </a>

        <a
          href="https://runner.bluelibs.com/"
          target="_blank"
          rel="noreferrer"
          className="docs-powered-by"
        >
          POWERED BY RUNNER
        </a>
      </div>
    </nav>
  );
};
