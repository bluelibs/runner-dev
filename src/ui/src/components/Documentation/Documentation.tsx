import React, { useEffect, useState } from "react";
import { Introspector } from "../../../../resources/models/Introspector";
import "./Documentation.scss";
import { DocumentationSidebar } from "./components/DocumentationSidebar";
import { DocumentationMainContent } from "./components/DocumentationMainContent";
import { useDocumentationFilters } from "./hooks/useDocumentationFilters";
import { useViewMode } from "./hooks/useViewMode";
import { useSidebarResize } from "./hooks/useSidebarResize";
// [AI-CHAT-DISABLED] import { useChatSidebarResize } from "./hooks/useChatSidebarResize";
import { useTreeNavigation } from "./hooks/useTreeNavigation";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { createSections } from "./config/documentationSections";
// [AI-CHAT-DISABLED] import { DOCUMENTATION_CONSTANTS } from "./config/documentationConstants";
// [AI-CHAT-DISABLED] import { ChatSidebar } from "./components/chat/ChatSidebar";
import { OverviewStatsPanel } from "./components/overview/OverviewStatsPanel";
import { ModalStackProvider } from "./components/modals";
import { useRef } from "react";

export type Section =
  | "overview"
  | "tasks"
  | "resources"
  | "events"
  | "hooks"
  | "middlewares"
  | "errors"
  | "asyncContexts"
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
  // [AI-CHAT-DISABLED] These props were used by ChatSidebar
  runnerFrameworkMd: _runnerFrameworkMd,
  runnerDevMd: _runnerDevMd,
  projectOverviewMd: _projectOverviewMd,
  graphqlSdl: _graphqlSdl,
}) => {
  const didInitHashHandlerRef = useRef(false);
  // [AI-CHAT-DISABLED] Chat sidebar is disabled — force closed
  const _isChatOpen = false;
  // const [isChatOpen, setIsChatOpen] = useState<boolean>(() => {
  //   try {
  //     return (
  //       localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_OPEN) ===
  //       "true"
  //     );
  //   } catch {
  //     return DOCUMENTATION_CONSTANTS.DEFAULTS.CHAT_OPEN;
  //   }
  // });

  // Dark mode state - default to true (dark mode by default)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("docs-dark-mode");
      return saved ? JSON.parse(saved) : true; // Default to dark mode
    } catch {
      return true; // Default to dark mode
    }
  });

  // Update document theme attribute and localStorage when dark mode changes
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    try {
      localStorage.setItem("docs-dark-mode", JSON.stringify(isDarkMode));
    } catch (error) {
      console.warn("Failed to save dark mode preference:", error);
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Custom hooks for state management
  const filterHook = useDocumentationFilters(introspector, namespacePrefix);
  const viewModeHook = useViewMode();
  // [AI-CHAT-DISABLED] const chatHook = useChatSidebarResize(40);
  const sidebarHook = useSidebarResize(0);
  const debouncedSidebarWidth = useDebouncedValue(
    sidebarHook.sidebarWidth,
    180
  );
  // [AI-CHAT-DISABLED] const debouncedChatWidth = useDebouncedValue(chatHook.chatWidth, 180);
  // [AI-CHAT-DISABLED] const [isChatTransitioning, setIsChatTransitioning] = useState(false);

  // [AI-CHAT-DISABLED] Chat toggle handler
  // const handleToggleChat = () => {
  //   setIsChatOpen((prev) => {
  //     const next = !prev;
  //     try {
  //       localStorage.setItem(
  //         DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_OPEN,
  //         String(next)
  //       );
  //     } catch {
  //       /* intentionally empty */
  //     }
  //     setIsChatTransitioning(true);
  //     window.setTimeout(() => setIsChatTransitioning(false), 260);
  //     return next;
  //   });
  // };

  // Hash-driven toggle for stats overlay; reacts to address bar changes
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(() => {
    try {
      return window.location.hash === "#overview-stats";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleHashChange = () => {
      try {
        setIsStatsOpen(window.location.hash === "#overview-stats");
      } catch {
        /* intentionally empty */
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Removed global Cmd/Ctrl+S shortcut for opening stats per UX request

  const openStats = () => {
    try {
      window.location.hash = "#overview-stats";
    } catch {
      /* intentionally empty */
    }
  };
  const closeStats = () => {
    try {
      if (window.location.hash === "#overview-stats") {
        window.location.hash = "#overview";
      }
    } catch {
      /* intentionally empty */
    }
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
    errors: introspector.getErrors().length,
    asyncContexts: introspector.getAsyncContexts().length,
    tags: filterHook.tags.length,
  });

  const totalComponents =
    filterHook.tasks.length +
    filterHook.resources.length +
    filterHook.events.length +
    filterHook.hooks.length +
    filterHook.middlewares.length;

  const resolveSectionFromElementId = React.useCallback(
    (elementId: string): string | null => {
      if (introspector.getTask(elementId)) return "tasks";
      if (introspector.getResource(elementId)) return "resources";
      if (introspector.getEvent(elementId)) return "events";
      if (introspector.getHook(elementId)) return "hooks";
      if (introspector.getMiddleware(elementId)) return "middlewares";
      if (introspector.getError(elementId)) return "errors";
      if (introspector.getAsyncContext(elementId)) return "asyncContexts";
      if (introspector.getTag(elementId)) return "tags";
      return null;
    },
    [introspector]
  );

  const handleSectionClick = (sectionId: string) => {
    // Update hash for deep-linking, then ensure the main content container scrolls
    window.location.hash = `#${sectionId}`;
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  };

  // Handle hash changes to clear search when navigating to filtered-out elements
  useEffect(() => {
    const scrollToCurrentHash = () => {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const id = hash.slice(1);
        const target = document.getElementById(id);
        target?.scrollIntoView({ behavior: "instant", block: "start" });
      }
    };

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
      scrollToCurrentHash();
    };

    // Re-scroll after potential layout changes (like diagnostic pane rendering)
    const handleLayoutChange = () => {
      // Add a small delay to ensure layout is complete
      setTimeout(scrollToCurrentHash, 100);
    };

    // Listen for diagnostic pane tab changes and other layout-affecting events
    const handleDiagnosticChange = () => {
      handleLayoutChange();
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("docs:layout-change", handleLayoutChange);
    window.addEventListener("docs:diagnostic-change", handleDiagnosticChange);

    // Run once on initial mount only
    if (!didInitHashHandlerRef.current) {
      handleHashChange();
      didInitHashHandlerRef.current = true;
    }

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("docs:layout-change", handleLayoutChange);
      window.removeEventListener(
        "docs:diagnostic-change",
        handleDiagnosticChange
      );
    };
  }, [
    filterHook.localNamespaceSearch,
    filterHook.allElements,
    filterHook.setLocalNamespaceSearch,
    introspector,
  ]);

  // Consider layout busy whenever dragging resizers or debounced widths are catching up
  const isLayoutBusy =
    sidebarHook.isResizing ||
    // [AI-CHAT-DISABLED] chatHook.isResizing ||
    // [AI-CHAT-DISABLED] isChatTransitioning ||
    debouncedSidebarWidth !== sidebarHook.sidebarWidth;

  return (
    <ModalStackProvider>
      <div className="docs-app">
        {/* Fixed Navigation Sidebar */}
        <DocumentationSidebar
          sidebarWidth={sidebarHook.sidebarWidth}
          sidebarRef={sidebarHook.sidebarRef}
          // [AI-CHAT-DISABLED] isChatOpen={isChatOpen}
          // [AI-CHAT-DISABLED] onToggleChat={handleToggleChat}
          leftOffset={0}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          viewMode={viewModeHook.viewMode}
          treeType={viewModeHook.treeType}
          localNamespaceSearch={filterHook.localNamespaceSearch}
          showSystem={filterHook.showSystem}
          showPrivate={filterHook.showPrivate}
          treeNodes={treeHook.treeNodes}
          sections={sections}
          totalComponents={totalComponents}
          onViewModeChange={viewModeHook.handleViewModeChange}
          onTreeTypeChange={viewModeHook.handleTreeTypeChange}
          onNamespaceSearchChange={filterHook.setLocalNamespaceSearch}
          onShowSystemChange={filterHook.handleShowSystemChange}
          onShowPrivateChange={filterHook.handleShowPrivateChange}
          onTreeNodeClick={treeHook.handleTreeNodeClick}
          onToggleExpansion={treeHook.handleToggleExpansion}
          onSectionClick={handleSectionClick}
          resolveSectionFromElementId={resolveSectionFromElementId}
        />

        {/* Sidebar Resizer */}
        <div
          ref={sidebarHook.resizerRef}
          className={`docs-sidebar-resizer ${
            sidebarHook.isResizing ? "docs-sidebar-resizer--active" : ""
          }`}
          style={{
            left: `${sidebarHook.sidebarWidth + 40}px`,
          }}
          onMouseDown={sidebarHook.handleMouseDown}
        />

        {/* Main Content */}
        <DocumentationMainContent
          introspector={introspector}
          sidebarWidth={debouncedSidebarWidth}
          // [AI-CHAT-DISABLED] chatWidth={debouncedChatWidth}
          // [AI-CHAT-DISABLED] isChatOpen={isChatOpen}
          openStats={openStats}
          isStatsOpen={isStatsOpen}
          closeStats={closeStats}
          // [AI-CHAT-DISABLED] chatPushesLeft
          suspendRendering={isLayoutBusy}
          tasks={filterHook.tasks}
          resources={filterHook.resources}
          events={filterHook.events}
          hooks={filterHook.hooks}
          middlewares={filterHook.middlewares}
          errors={introspector.getErrors()}
          asyncContexts={introspector.getAsyncContexts()}
          tags={filterHook.tags}
          sections={sections}
        />

        {/* "Open Stats" button moved next to the Overview header inside main content */}

        {/* [AI-CHAT-DISABLED] ChatSidebar and resizer removed — isChatOpen is always false */}

        {/* Render overlayed stats panel when hash requests it */}
        {isStatsOpen && <OverviewStatsPanel overlay onClose={closeStats} />}
      </div>
    </ModalStackProvider>
  );
};
