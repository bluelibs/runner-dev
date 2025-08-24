import React, { useEffect } from "react";
import { Introspector } from "../../../../resources/models/Introspector";
import "./Documentation.scss";
import { DocumentationSidebar } from "./components/DocumentationSidebar";
import { DocumentationMainContent } from "./components/DocumentationMainContent";
import { useDocumentationFilters } from "./hooks/useDocumentationFilters";
import { useViewMode } from "./hooks/useViewMode";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useTreeNavigation } from "./hooks/useTreeNavigation";
import { createSections } from "./config/documentationSections";
import { DOCUMENTATION_CONSTANTS } from "./config/documentationConstants";

export type Section =
  | "overview"
  | "tasks"
  | "resources"
  | "events"
  | "hooks"
  | "middlewares"
  | "tags"
  | "diagnostics"
  | "live";

export interface DocumentationProps {
  introspector: Introspector;
  namespacePrefix?: string;
}

export const Documentation: React.FC<DocumentationProps> = ({
  introspector,
  namespacePrefix,
}) => {
  // Custom hooks for state management
  const filterHook = useDocumentationFilters(introspector, namespacePrefix);
  const viewModeHook = useViewMode();
  const sidebarHook = useSidebarResize();
  
  const treeHook = useTreeNavigation(
    filterHook.allElements,
    viewModeHook.treeType,
    filterHook.localNamespaceSearch,
    introspector,
    {
      tasks: filterHook.tasks,
      resources: filterHook.resources,
      events: filterHook.events,
      hooks: filterHook.hooks,
      middlewares: filterHook.middlewares,
      tags: filterHook.tags,
    }
  );

  // Generate sections configuration
  const sections = createSections({
    tasks: filterHook.tasks.length,
    resources: filterHook.resources.length,
    events: filterHook.events.length,
    hooks: filterHook.hooks.length,
    middlewares: filterHook.middlewares.length,
    tags: filterHook.tags.length,
  });

  const totalComponents = 
    filterHook.tasks.length +
    filterHook.resources.length +
    filterHook.events.length +
    filterHook.hooks.length +
    filterHook.middlewares.length;





  // Handle hash changes to clear search when navigating to filtered-out elements
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#element-") && filterHook.localNamespaceSearch) {
        const elementId = hash.substring(9); // Remove '#element-' prefix

        // Get all unfiltered elements
        const allUnfilteredElements = introspector.getAll();

        // Get all currently filtered (visible) elements
        const allFilteredElements = filterHook.allElements;

        // Check if the target element exists in unfiltered but not in filtered
        const elementExistsUnfiltered = allUnfilteredElements.some(
          (el) => el.id === elementId
        );
        const elementExistsFiltered = allFilteredElements.some(
          (el) => el.id === elementId
        );

        if (elementExistsUnfiltered && !elementExistsFiltered) {
          filterHook.resetFilters();
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [
    filterHook.localNamespaceSearch,
    filterHook.allElements,
    filterHook.setLocalNamespaceSearch,
    introspector,
  ]);


  if (window !== undefined) {
    console.log(introspector.serialize());
  }

  return (
    <div className="docs-app">
      {/* Fixed Navigation Sidebar */}
      <DocumentationSidebar
        sidebarWidth={sidebarHook.sidebarWidth}
        sidebarRef={sidebarHook.sidebarRef}
        viewMode={viewModeHook.viewMode}
        treeType={viewModeHook.treeType}
        localNamespaceSearch={filterHook.localNamespaceSearch}
        showSystem={filterHook.showSystem}
        treeNodes={treeHook.treeNodes}
        sections={sections}
        totalComponents={totalComponents}
        onViewModeChange={viewModeHook.handleViewModeChange}
        onTreeTypeChange={viewModeHook.handleTreeTypeChange}
        onNamespaceSearchChange={filterHook.setLocalNamespaceSearch}
        onShowSystemChange={filterHook.handleShowSystemChange}
        onTreeNodeClick={treeHook.handleTreeNodeClick}
        onToggleExpansion={treeHook.handleToggleExpansion}
      />

      {/* Sidebar Resizer */}
      <div
        ref={sidebarHook.resizerRef}
        className={`docs-sidebar-resizer ${
          sidebarHook.isResizing ? "docs-sidebar-resizer--active" : ""
        }`}
        style={{ left: `${sidebarHook.sidebarWidth + 40}px` }}
        onMouseDown={sidebarHook.handleMouseDown}
      />

      {/* Main Content */}
      <DocumentationMainContent
        introspector={introspector}
        sidebarWidth={sidebarHook.sidebarWidth}
        tasks={filterHook.tasks}
        resources={filterHook.resources}
        events={filterHook.events}
        hooks={filterHook.hooks}
        middlewares={filterHook.middlewares}
        tags={filterHook.tags}
      />
    </div>
  );
};
