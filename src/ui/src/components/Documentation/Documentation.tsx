import React, { useEffect, useMemo, useState } from "react";
import { Introspector } from "../../../../resources/models/Introspector";
import "./Documentation.scss";
import { DocumentationSidebar } from "./components/DocumentationSidebar";
import { DocumentationMainContent } from "./components/DocumentationMainContent";
import { useDocumentationFilters } from "./hooks/useDocumentationFilters";
import { useViewMode } from "./hooks/useViewMode";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useChatSidebarResize } from "./hooks/useChatSidebarResize";
import { useTreeNavigation } from "./hooks/useTreeNavigation";
import { createSections } from "./config/documentationSections";
import { DOCUMENTATION_CONSTANTS } from "./config/documentationConstants";
import { ChatSidebar } from "./components/ChatSidebar";

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
  const chatHook = useChatSidebarResize(40);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_OPEN) ===
        "true"
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.CHAT_OPEN;
    }
  });

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_OPEN,
          String(next)
        );
      } catch {}
      return next;
    });
  };

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

  const handleSectionClick = (sectionId: string) => {
    // Update hash for deep-linking, then ensure the main content container scrolls
    window.location.hash = `#${sectionId}`;
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  };

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

      // Always try to bring the target section/element into view inside the main container
      if (hash && hash.length > 1) {
        const id = hash.slice(1);
        const target = document.getElementById(id);
        target?.scrollIntoView({ behavior: "instant", block: "start" });
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
        isChatOpen={isChatOpen}
        onToggleChat={handleToggleChat}
        leftOffset={isChatOpen ? chatHook.chatWidth + 40 : 0}
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
        onSectionClick={handleSectionClick}
      />

      {/* Sidebar Resizer */}
      <div
        ref={sidebarHook.resizerRef}
        className={`docs-sidebar-resizer ${
          sidebarHook.isResizing ? "docs-sidebar-resizer--active" : ""
        }`}
        style={{
          left: `${(isChatOpen ? chatHook.chatWidth + 40 : 0) + sidebarHook.sidebarWidth + 40}px`,
        }}
        onMouseDown={sidebarHook.handleMouseDown}
      />

      {/* Main Content */}
      <DocumentationMainContent
        introspector={introspector}
        sidebarWidth={sidebarHook.sidebarWidth}
        chatWidth={chatHook.chatWidth}
        isChatOpen={isChatOpen}
        chatPushesLeft
        tasks={filterHook.tasks}
        resources={filterHook.resources}
        events={filterHook.events}
        hooks={filterHook.hooks}
        middlewares={filterHook.middlewares}
        tags={filterHook.tags}
      />

      {isChatOpen && (
        <>
          <div
            ref={chatHook.resizerRef}
            className={`docs-sidebar-resizer ${
              chatHook.isResizing ? "docs-sidebar-resizer--active" : ""
            }`}
            style={{ left: `${chatHook.chatWidth + 40}px` }}
            onMouseDown={chatHook.handleMouseDown}
          />
          <ChatSidebar
            width={chatHook.chatWidth}
            sidebarRef={chatHook.sidebarRef}
          />
        </>
      )}
    </div>
  );
};
