import React from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { TaskCard } from "./TaskCard";
import { ResourceCard } from "./ResourceCard";
import { MiddlewareCard } from "./MiddlewareCard";
import { EventCard } from "./EventCard";
import { HookCard } from "./HookCard";
import { TagCard } from "./TagCard";
import { ErrorCard } from "./ErrorCard";
import { AsyncContextCard } from "./AsyncContextCard";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { LivePanel } from "./LivePanel";
import { ElementTable } from "./ElementTable";

export interface DocumentationMainContentProps {
  introspector: Introspector;
  sidebarWidth: number;
  chatWidth?: number;
  isChatOpen?: boolean;
  chatPushesLeft?: boolean;
  // Control for the inline stats panel
  openStats?: () => void;
  isStatsOpen?: boolean;
  closeStats?: () => void;
  suspendRendering?: boolean;
  tasks: any[];
  resources: any[];
  events: any[];
  hooks: any[];
  middlewares: any[];
  errors: any[];
  asyncContexts: any[];
  tags: any[];
}

export const DocumentationMainContent: React.FC<
  DocumentationMainContentProps
> = ({
  introspector,
  sidebarWidth,
  chatWidth,
  isChatOpen,
  chatPushesLeft,
  openStats,
  isStatsOpen,
  closeStats,
  suspendRendering = false,
  tasks,
  resources,
  events,
  hooks,
  middlewares,
  errors,
  asyncContexts,
  tags,
}) => {
  const rootResource = introspector.getRoot();
  const rootTitle =
    rootResource?.meta?.title || "Runner Application Documentation";
  const rootDescription =
    rootResource?.meta?.description ||
    "Complete overview of your application's architecture and components";

  return (
    <div
      className={`docs-main-content ${
        suspendRendering ? "docs-main-content--suspended" : ""
      }`}
      style={{
        marginLeft: `${
          sidebarWidth +
          (chatPushesLeft && isChatOpen ? chatWidth || 0 : 0) +
          40
        }px`,
        marginRight: undefined,
      }}
    >
      {suspendRendering && <div className="docs-main-overlay" />}
      <div className="docs-content-container">
        <header id="top" className="docs-header">
          <h1>{rootTitle}</h1>
          <p>{rootDescription}</p>
        </header>

        <section id="live" className="docs-section">
          <h2>📡 Live Telemetry</h2>
          <LivePanel detailed introspector={introspector} />
        </section>

        <section id="diagnostics" className="docs-section">
          <h2>🔍 Diagnostics</h2>
          <DiagnosticsPanel introspector={introspector} detailed />
        </section>

        <section id="overview" className="docs-section">
          <div className="overview-header">
            <h2>📋 Overview</h2>
            <div>
              <button
                onClick={openStats}
                aria-label="Open Stats"
                title="Open Stats"
                className="clean-button"
              >
                📊
              </button>
            </div>
          </div>
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
            {errors.length > 0 && (
              <a href="#errors" className="card card--errors">
                <h3>Errors</h3>
                <div className="count">{errors.length}</div>
              </a>
            )}
            {asyncContexts.length > 0 && (
              <a href="#asyncContexts" className="card card--async-contexts">
                <h3>Async Contexts</h3>
                <div className="count">{asyncContexts.length}</div>
              </a>
            )}
            <a href="#tags" className="card card--tags">
              <h3>Tags</h3>
              <div className="count">{tags.length}</div>
            </a>
          </div>
        </section>

        {/* Inline stats panel is no longer rendered here; overlay is handled by parent */}

        {tasks.length > 0 && (
          <ElementTable
            elements={tasks}
            title="Tasks Overview"
            icon="⚙️"
            id="tasks"
            enableActions="task"
            onAction={(el) => {
              // Ask the TaskCard to open its Run modal via a custom event
              window.dispatchEvent(
                new CustomEvent("docs:execute-element", {
                  detail: { type: "task", id: el.id },
                })
              );
            }}
          />
        )}
        {tasks.length > 0 && (
          <section className="docs-section">
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
          <ElementTable
            elements={resources}
            title="Resources Overview"
            icon="🔧"
            id="resources"
          />
        )}
        {resources.length > 0 && (
          <section className="docs-section">
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
          <ElementTable
            elements={events}
            title="Events Overview"
            icon="📡"
            id="events"
            enableActions="event"
            onAction={(el) => {
              // Ask the EventCard to open its Emit modal via a custom event
              window.dispatchEvent(
                new CustomEvent("docs:execute-element", {
                  detail: { type: "event", id: el.id },
                })
              );
            }}
          />
        )}
        {events.length > 0 && (
          <section className="docs-section">
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
          <ElementTable
            elements={hooks}
            title="Hooks Overview"
            icon="🪝"
            id="hooks"
          />
        )}
        {hooks.length > 0 && (
          <section className="docs-section">
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

        {errors.length > 0 && (
          <ElementTable
            elements={errors}
            title="Errors Overview"
            icon="❌"
            id="errors"
          />
        )}
        {errors.length > 0 && (
          <section className="docs-section">
            <h2>❌ Errors ({errors.length})</h2>
            <div className="docs-component-grid">
              {errors.map((error) => (
                <ErrorCard
                  key={error.id}
                  error={error}
                  introspector={introspector}
                />
              ))}
            </div>
          </section>
        )}

        {asyncContexts.length > 0 && (
          <ElementTable
            elements={asyncContexts}
            title="Async Contexts Overview"
            icon="🔄"
            id="asyncContexts"
          />
        )}
        {asyncContexts.length > 0 && (
          <section className="docs-section">
            <h2>🔄 Async Contexts ({asyncContexts.length})</h2>
            <div className="docs-component-grid">
              {asyncContexts.map((asyncContext) => (
                <AsyncContextCard
                  key={asyncContext.id}
                  asyncContext={asyncContext}
                  introspector={introspector}
                />
              ))}
            </div>
          </section>
        )}

        {middlewares.length > 0 && (
          <ElementTable
            elements={middlewares}
            title="Middlewares Overview"
            icon="🔗"
            id="middlewares"
          />
        )}
        {middlewares.length > 0 && (
          <section className="docs-section">
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
          <ElementTable
            elements={tags}
            title="Tags Overview"
            icon="🏷️"
            id="tags"
          />
        )}
        {tags.length > 0 && (
          <section className="docs-section">
            <h2>Tags ({tags.length})</h2>
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
