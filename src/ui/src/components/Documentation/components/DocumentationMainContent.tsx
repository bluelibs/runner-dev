import React from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { TaskCard } from "./TaskCard";
import { ResourceCard } from "./ResourceCard";
import { MiddlewareCard } from "./MiddlewareCard";
import { EventCard } from "./EventCard";
import { HookCard } from "./HookCard";
import { TagCard } from "./TagCard";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { LivePanel } from "./LivePanel";

export interface DocumentationMainContentProps {
  introspector: Introspector;
  sidebarWidth: number;
  tasks: any[];
  resources: any[];
  events: any[];
  hooks: any[];
  middlewares: any[];
  tags: any[];
}

export const DocumentationMainContent: React.FC<DocumentationMainContentProps> = ({
  introspector,
  sidebarWidth,
  tasks,
  resources,
  events,
  hooks,
  middlewares,
  tags,
}) => {
  return (
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
          <LivePanel detailed introspector={introspector} />
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
  );
};