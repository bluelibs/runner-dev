import React, { useState, useEffect, useRef, useCallback } from "react";
import { Introspector } from "../../../../resources/models/Introspector";
import "./Documentation.scss";
import { TreeView } from "./components/TreeView";
import {
  buildNamespaceTree,
  buildTypeFirstTree,
  filterTree,
  toggleNodeExpansion,
  TreeNode,
} from "./utils/tree-utils";
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
import { TaskCard } from "./components/TaskCard";
import { ResourceCard } from "./components/ResourceCard";
import { MiddlewareCard } from "./components/MiddlewareCard";
import { EventCard } from "./components/EventCard";
import { HookCard } from "./components/HookCard";
import { TagCard } from "./components/TagCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { LivePanel } from "./components/LivePanel";

export interface DocumentationProps {
  introspector: Introspector;
  namespacePrefix?: string;
}

export const Documentation: React.FC<DocumentationProps> = ({
  introspector,
  namespacePrefix,
}) => {
  const [localNamespaceSearch, setLocalNamespaceSearch] = useState(
    namespacePrefix || ""
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return parseInt(localStorage.getItem("docs-sidebar-width") || "280", 10);
    } catch {
      return 280;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "tree">(() => {
    try {
      return (
        (localStorage.getItem("docs-view-mode") as "list" | "tree") || "list"
      );
    } catch {
      return "list";
    }
  });
  const [treeType, setTreeType] = useState<"namespace" | "type">(() => {
    try {
      return (
        (localStorage.getItem("docs-tree-type") as "namespace" | "type") ||
        "namespace"
      );
    } catch {
      return "namespace";
    }
  });
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  // Sync local state when prop changes
  useEffect(() => {
    setLocalNamespaceSearch(namespacePrefix || "");
  }, [namespacePrefix]);

  const filterByNamespace = (items: any[]) => {
    if (!localNamespaceSearch) return items;
    return items.filter((item) => item.id.includes(localNamespaceSearch));
  };

  const tasks = filterByNamespace(introspector.getTasks());
  const resources = filterByNamespace(introspector.getResources());
  const events = filterByNamespace(introspector.getEvents());
  const hooks = filterByNamespace(introspector.getHooks());
  const middlewares = filterByNamespace(introspector.getMiddlewares());
  const tags = filterByNamespace(introspector.getAllTags());

  // Build tree data when elements or view mode changes
  useEffect(() => {
    const allElements = [
      ...tasks,
      ...resources,
      ...events,
      ...hooks,
      ...middlewares,
      ...tags,
    ];

    let tree: TreeNode[];
    if (treeType === "namespace") {
      tree = buildNamespaceTree(allElements);
    } else {
      tree = buildTypeFirstTree(allElements);
    }

    // Apply search filter
    if (localNamespaceSearch) {
      tree = filterTree(tree, localNamespaceSearch);
    }

    setTreeNodes(tree);
  }, [
    tasks,
    resources,
    events,
    hooks,
    middlewares,
    tags,
    treeType,
    localNamespaceSearch,
  ]);

  // Handlers for tree interaction
  const handleTreeNodeClick = (node: TreeNode) => {
    if (!node.elementId) return;

    const anchorId = `element-${node.elementId}`;

    // If already at this hash, force scroll; otherwise update hash for instant navigation
    if (window.location.hash === `#${anchorId}`) {
      document
        .getElementById(anchorId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.hash = `#${anchorId}`;
    }

    const target = document.getElementById(anchorId);
    if (target) {
      target.classList.add("docs-highlight-target");
      setTimeout(() => {
        target.classList.remove("docs-highlight-target");
      }, 2000);
    }
  };

  const handleToggleExpansion = (nodeId: string, expanded?: boolean) => {
    setTreeNodes((prevNodes) =>
      toggleNodeExpansion(prevNodes, nodeId, expanded)
    );
  };

  // Persist view mode preference
  const handleViewModeChange = (mode: "list" | "tree") => {
    setViewMode(mode);
    try {
      localStorage.setItem("docs-view-mode", mode);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Persist tree type preference
  const handleTreeTypeChange = (type: "namespace" | "type") => {
    setTreeType(type);
    try {
      localStorage.setItem("docs-tree-type", type);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Handle sidebar resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.min(Math.max(e.clientX, 200), 600);
      setSidebarWidth(newWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return;

    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    try {
      localStorage.setItem("docs-sidebar-width", sidebarWidth.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const sections = [
    {
      id: "overview",
      label: "Overview",
      icon: "📋",
      count: null,
      hasContent: true,
    },
    {
      id: "live",
      label: "Live",
      icon: "📡",
      count: null,
      hasContent: true,
    },
    {
      id: "diagnostics",
      label: "Diagnostics",
      icon: "🔍",
      count: null,
      hasContent: true,
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: "⚙️",
      count: tasks.length,
      hasContent: tasks.length > 0,
    },
    {
      id: "resources",
      label: "Resources",
      icon: "🔧",
      count: resources.length,
      hasContent: resources.length > 0,
    },
    {
      id: "events",
      label: "Events",
      icon: "📡",
      count: events.length,
      hasContent: events.length > 0,
    },
    {
      id: "hooks",
      label: "Hooks",
      icon: "🪝",
      count: hooks.length,
      hasContent: hooks.length > 0,
    },
    {
      id: "middlewares",
      label: "Middlewares",
      icon: "🔗",
      count: middlewares.length,
      hasContent: middlewares.length > 0,
    },
    {
      id: "tags",
      label: "Tags",
      icon: "🏷️",
      count: tags.length,
      hasContent: tags.length > 0,
    },
  ].filter((section) => section.hasContent);

  if (window !== undefined) {
    console.log(introspector.serialize());
  }

  return (
    <div className="docs-app">
      {/* Fixed Navigation Sidebar */}
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
              onClick={() => handleViewModeChange("list")}
              title="List View"
            >
              📄 List
            </button>
            <button
              className={`docs-view-button ${
                viewMode === "tree" ? "active" : ""
              }`}
              onClick={() => handleViewModeChange("tree")}
              title="Tree View"
            >
              🌳 Tree
            </button>
          </div>
          {viewMode === "tree" && (
            <div className="docs-tree-controls">
              <select
                value={treeType}
                onChange={(e) =>
                  handleTreeTypeChange(e.target.value as "namespace" | "type")
                }
                className="docs-tree-type-select"
              >
                <option value="namespace">By Namespace</option>
                <option value="type">By Type</option>
              </select>
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
            onChange={(e) => setLocalNamespaceSearch(e.target.value)}
          />
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
              onNodeClick={handleTreeNodeClick}
              onToggleExpansion={handleToggleExpansion}
              searchTerm={localNamespaceSearch}
              className="docs-tree-view"
            />
          </div>
        )}

        <div className="docs-nav-stats">
          <div className="label">Quick Stats</div>
          <div className="value">
            {tasks.length +
              resources.length +
              events.length +
              hooks.length +
              middlewares.length}
          </div>
          <div className="description">Total Components</div>
        </div>
      </nav>

      {/* Sidebar Resizer */}
      <div
        ref={resizerRef}
        className={`docs-sidebar-resizer ${
          isResizing ? "docs-sidebar-resizer--active" : ""
        }`}
        style={{ left: `${sidebarWidth + 40}px` }}
        onMouseDown={handleMouseDown}
      />

      {/* Main Content */}
      <div
        className="docs-main-content"
        style={{ marginLeft: `${sidebarWidth + 40}px` }}
      >
        <div className="docs-content-container">
          <header id="top" className="docs-header">
            <h1>Runner Application Documentation</h1>
            <p>
              Complete overview of your application's architecture and
              components
            </p>
          </header>

          <section id="overview" className="docs-section">
            <h2>📋 Overview</h2>
            <div className="overview-grid">
              <a href="#tasks" className="card card--tasks">
                <h3>Tasks</h3>
                <div className="count">{tasks.length}</div>
              </a>
              <a href="#resources" className="card card--resources">
                <h3>Resources</h3>
                <div className="count">{resources.length}</div>
              </a>
              <a href="#events" className="card card--events">
                <h3>Events</h3>
                <div className="count">{events.length}</div>
              </a>
              <a href="#middlewares" className="card card--middlewares">
                <h3>Middlewares</h3>
                <div className="count">{middlewares.length}</div>
              </a>
              <a href="#hooks" className="card card--hooks">
                <h3>Hooks</h3>
                <div className="count">{hooks.length}</div>
              </a>
            </div>
          </section>

          <section id="live" className="docs-section">
            <h2>📡 Live Telemetry</h2>
            <LivePanel detailed />
          </section>

          <section id="diagnostics" className="docs-section">
            <h2>🔍 Diagnostics</h2>
            <DiagnosticsPanel introspector={introspector} detailed />
          </section>

          {tasks.length > 0 && (
            <section id="tasks" className="docs-section">
              <h2>⚙️ Tasks ({tasks.length})</h2>
              <div className="docs-component-grid">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}

          {resources.length > 0 && (
            <section id="resources" className="docs-section">
              <h2>🔧 Resources ({resources.length})</h2>
              <div className="docs-component-grid">
                {resources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}

          {events.length > 0 && (
            <section id="events" className="docs-section">
              <h2>📡 Events ({events.length})</h2>
              <div className="docs-component-grid">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}

          {hooks.length > 0 && (
            <section id="hooks" className="docs-section">
              <h2>🪝 Hooks ({hooks.length})</h2>
              <div className="docs-component-grid">
                {hooks.map((hook) => (
                  <HookCard
                    key={hook.id}
                    hook={hook}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}

          {middlewares.length > 0 && (
            <section id="middlewares" className="docs-section">
              <h2>🔗 Middlewares ({middlewares.length})</h2>
              <div className="docs-component-grid">
                {middlewares.map((middleware) => (
                  <MiddlewareCard
                    key={middleware.id}
                    middleware={middleware}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section id="tags" className="docs-section">
              <h2>🏷️ Tags ({tags.length})</h2>
              <div className="docs-tags-grid">
                {tags.map((tag) => (
                  <TagCard key={tag.id} tag={tag} introspector={introspector} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
