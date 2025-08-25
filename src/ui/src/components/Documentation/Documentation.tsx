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
import { useDebouncedValue } from "./hooks/useDebouncedValue";
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
  runnerFrameworkMd?: string;
  runnerDevMd?: string;
  projectOverviewMd?: string;
  graphqlSdl?: string;
}

export const Documentation: React.FC<DocumentationProps> = ({
  introspector,
  namespacePrefix,
  runnerFrameworkMd,
  runnerDevMd,
  projectOverviewMd,
  graphqlSdl,
}) => {
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

  // Custom hooks for state management
  const filterHook = useDocumentationFilters(introspector, namespacePrefix);
  const viewModeHook = useViewMode();
  const chatHook = useChatSidebarResize(40);
  const sidebarHook = useSidebarResize(
    isChatOpen ? chatHook.chatWidth + 40 : 0
  );
  const debouncedSidebarWidth = useDebouncedValue(
    sidebarHook.sidebarWidth,
    180
  );
  const debouncedChatWidth = useDebouncedValue(chatHook.chatWidth, 180);
  const [isChatTransitioning, setIsChatTransitioning] = useState(false);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_OPEN,
          String(next)
        );
      } catch {}
      // Mark a brief transition window for overlay while chat opens/closes
      setIsChatTransitioning(true);
      window.setTimeout(() => setIsChatTransitioning(false), 260);
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

  // Consider layout busy whenever dragging resizers or debounced widths are catching up
  const isLayoutBusy =
    sidebarHook.isResizing ||
    chatHook.isResizing ||
    isChatTransitioning ||
    debouncedSidebarWidth !== sidebarHook.sidebarWidth ||
    debouncedChatWidth !== chatHook.chatWidth;

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
          left: `${
            (isChatOpen ? chatHook.chatWidth + 40 : 0) +
            sidebarHook.sidebarWidth +
            40
          }px`,
        }}
        onMouseDown={sidebarHook.handleMouseDown}
      />

      {/* Main Content */}
      <DocumentationMainContent
        introspector={introspector}
        sidebarWidth={debouncedSidebarWidth}
        chatWidth={debouncedChatWidth}
        isChatOpen={isChatOpen}
        chatPushesLeft
        suspendRendering={isLayoutBusy}
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
            onToggleChat={handleToggleChat}
            isChatOpen={isChatOpen}
            runnerAiMd={runnerFrameworkMd}
            runnerDevMd={runnerDevMd}
            projectOverviewMd={projectOverviewMd}
            graphqlSdl={graphqlSdl}
            availableElements={{
              tasks: filterHook.tasks.map((task) => ({
                id: task.id,
                name: task.id,
                title: task.meta?.title || undefined,
                description: task.meta?.description || undefined,
              })),
              resources: filterHook.resources.map((resource) => ({
                id: resource.id,
                name: resource.id,
                title: resource.meta?.title || undefined,
                description: resource.meta?.description || undefined,
              })),
              events: filterHook.events.map((event) => ({
                id: event.id,
                name: event.id,
                title: event.meta?.title || undefined,
                description: event.meta?.description || undefined,
              })),
              hooks: filterHook.hooks.map((hook) => ({
                id: hook.id,
                name: hook.id,
                title: hook.meta?.title || undefined,
                description: hook.meta?.description || undefined,
              })),
              middlewares: filterHook.middlewares.map((middleware) => ({
                id: middleware.id,
                name: middleware.id,
                title: middleware.meta?.title || undefined,
                description: middleware.meta?.description || undefined,
              })),
              tags: filterHook.tags.map((tag) => ({
                id: tag.id,
                name: tag.id,
                title: tag.meta?.title || undefined,
                description: tag.meta?.description || undefined,
              })),
            }}
          />
        </>
      )}
    </div>
  );
};
