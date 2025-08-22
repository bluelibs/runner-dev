import React, { useState, useEffect } from "react";
import { Introspector } from "../../../../resources/models/Introspector";
import "./Documentation.scss";
export type Section =
  | "overview"
  | "tasks"
  | "resources"
  | "events"
  | "hooks"
  | "middlewares"
  | "tags"
  | "diagnostics";
import { TaskCard } from "./components/TaskCard";
import { ResourceCard } from "./components/ResourceCard";
import { MiddlewareCard } from "./components/MiddlewareCard";
import { EventCard } from "./components/EventCard";
import { HookCard } from "./components/HookCard";
import { TagCard } from "./components/TagCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

export interface DocumentationProps {
  introspector: Introspector;
  namespacePrefix?: string;
}

export const Documentation: React.FC<DocumentationProps> = ({
  introspector,
  namespacePrefix,
}) => {
  const [localNamespacePrefix, setLocalNamespacePrefix] = useState(
    namespacePrefix || ""
  );
  // Sync local state when prop changes
  useEffect(() => {
    setLocalNamespacePrefix(namespacePrefix || "");
  }, [namespacePrefix]);
  const filterByNamespace = (items: any[]) => {
    if (!localNamespacePrefix) return items;
    return items.filter((item) => item.id.startsWith(localNamespacePrefix));
  };

  const tasks = filterByNamespace(introspector.getTasks());
  const resources = filterByNamespace(introspector.getResources());
  const events = filterByNamespace(introspector.getEvents());
  const hooks = filterByNamespace(introspector.getHooks());
  const middlewares = filterByNamespace(introspector.getMiddlewares());
  const tags = filterByNamespace(introspector.getAllTags());

  const sections = [
    {
      id: "overview",
      label: "Overview",
      icon: "📋",
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

  return (
    <div className="docs-app">
      {/* Fixed Navigation Sidebar */}
      <nav className="docs-sidebar">
        <div className="docs-nav-header">
          <h2>📚 Documentation</h2>
          <p>Navigate through your application components</p>
        </div>

        {/* Namespace Prefix Input */}
        <div className="docs-namespace-input">
          <input
            type="text"
            placeholder="Namespace Prefix"
            value={localNamespacePrefix}
            onChange={(e) => setLocalNamespacePrefix(e.target.value)}
          />
        </div>

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
                  <span className="docs-nav-badge">
                    {section.count}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>

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

      {/* Main Content */}
      <div className="docs-main-content">
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
              <div className="card card--tasks">
                <h3>Tasks</h3>
                <div className="count">{tasks.length}</div>
              </div>
              <div className="card card--resources">
                <h3>Resources</h3>
                <div className="count">{resources.length}</div>
              </div>
              <div className="card card--events">
                <h3>Events</h3>
                <div className="count">{events.length}</div>
              </div>
              <div className="card card--middlewares">
                <h3>Middlewares</h3>
                <div className="count">{middlewares.length}</div>
              </div>
              <div className="card card--hooks">
                <h3>Hooks</h3>
                <div className="count">{hooks.length}</div>
              </div>
            </div>
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
              <div className="overview-grid">
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
