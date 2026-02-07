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
  sections: Array<{
    id: string;
    label: string;
    icon: string;
    count: number | null;
    hasContent: boolean;
  }>;
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
  _isStatsOpen,
  _closeStats,
  suspendRendering = false,
  tasks,
  resources,
  events,
  hooks,
  middlewares,
  errors,
  asyncContexts,
  tags,
  sections,
}) => {
  const rootResource = introspector.getRoot();
  const rootTitle =
    rootResource?.meta?.title || "Runner Application Documentation";
  const rootDescription =
    rootResource?.meta?.description ||
    "Complete overview of your application's architecture and components";

  const resolveSectionFromHash = React.useCallback(
    (hash: string): string => {
      const availableSections = new Set(sections.map((section) => section.id));
      const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
      const cleanHash = (() => {
        try {
          return decodeURIComponent(rawHash);
        } catch {
          return rawHash;
        }
      })();
      const pickSection = (sectionId: string): string =>
        availableSections.has(sectionId)
          ? sectionId
          : availableSections.has("overview")
          ? "overview"
          : sections[0]?.id || "overview";

      if (!cleanHash || cleanHash === "top" || cleanHash === "overview-stats") {
        return pickSection("overview");
      }

      if (availableSections.has(cleanHash)) return cleanHash;

      if (cleanHash.startsWith("element-")) {
        const elementId = cleanHash.slice("element-".length);
        if (introspector.getTask(elementId)) return pickSection("tasks");
        if (introspector.getResource(elementId))
          return pickSection("resources");
        if (introspector.getEvent(elementId)) return pickSection("events");
        if (introspector.getHook(elementId)) return pickSection("hooks");
        if (introspector.getMiddleware(elementId))
          return pickSection("middlewares");
        if (introspector.getError(elementId)) return pickSection("errors");
        if (introspector.getAsyncContext(elementId))
          return pickSection("asyncContexts");
        if (introspector.getTag(elementId)) return pickSection("tags");
      }

      return pickSection("overview");
    },
    [sections, introspector]
  );

  const scrollToHashTarget = React.useCallback(() => {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return;

    const targetId = (() => {
      try {
        return decodeURIComponent(hash.slice(1));
      } catch {
        return hash.slice(1);
      }
    })();

    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  const [activeSection, setActiveSection] = React.useState<string>(() =>
    resolveSectionFromHash(
      typeof window !== "undefined" ? window.location.hash : "#overview"
    )
  );

  React.useEffect(() => {
    const updateFromHash = () => {
      setActiveSection(resolveSectionFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", updateFromHash);
    updateFromHash();
    return () => window.removeEventListener("hashchange", updateFromHash);
  }, [resolveSectionFromHash]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollToHashTarget();
    });

    const timeoutId = window.setTimeout(() => {
      scrollToHashTarget();
    }, 80);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, scrollToHashTarget]);

  const handleTabClick = React.useCallback((sectionId: string) => {
    window.location.hash = `#${sectionId}`;
  }, []);

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

        <div className="docs-section-tabs" role="tablist" aria-label="Sections">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`docs-section-tab ${
                activeSection === section.id ? "docs-section-tab--active" : ""
              }`}
              onClick={() => handleTabClick(section.id)}
            >
              <span className="docs-section-tab__icon">{section.icon}</span>
              <span className="docs-section-tab__label">{section.label}</span>
              {section.count !== null && (
                <span className="docs-section-tab__count">{section.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeSection === "live" && (
          <section id="live" className="docs-section">
            <h2>📡 Live Telemetry</h2>
            <LivePanel detailed introspector={introspector} />
          </section>
        )}

        {activeSection === "diagnostics" && (
          <section id="diagnostics" className="docs-section">
            <h2>🔍 Diagnostics</h2>
            <DiagnosticsPanel introspector={introspector} detailed />
          </section>
        )}

        {activeSection === "overview" && (
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
        )}

        {/* Inline stats panel is no longer rendered here; overlay is handled by parent */}

        {activeSection === "tasks" && tasks.length > 0 && (
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
        {activeSection === "tasks" && tasks.length > 0 && (
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

        {activeSection === "resources" && resources.length > 0 && (
          <ElementTable
            elements={resources}
            title="Resources Overview"
            icon="🔧"
            id="resources"
          />
        )}
        {activeSection === "resources" && resources.length > 0 && (
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

        {activeSection === "events" && events.length > 0 && (
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
        {activeSection === "events" && events.length > 0 && (
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

        {activeSection === "hooks" && hooks.length > 0 && (
          <ElementTable
            elements={hooks}
            title="Hooks Overview"
            icon="🪝"
            id="hooks"
          />
        )}
        {activeSection === "hooks" && hooks.length > 0 && (
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

        {activeSection === "errors" && errors.length > 0 && (
          <ElementTable
            elements={errors}
            title="Errors Overview"
            icon="❌"
            id="errors"
          />
        )}
        {activeSection === "errors" && errors.length > 0 && (
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

        {activeSection === "asyncContexts" && asyncContexts.length > 0 && (
          <ElementTable
            elements={asyncContexts}
            title="Async Contexts Overview"
            icon="🔄"
            id="asyncContexts"
          />
        )}
        {activeSection === "asyncContexts" && asyncContexts.length > 0 && (
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

        {activeSection === "middlewares" && middlewares.length > 0 && (
          <ElementTable
            elements={middlewares}
            title="Middlewares Overview"
            icon="🔗"
            id="middlewares"
          />
        )}
        {activeSection === "middlewares" && middlewares.length > 0 && (
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

        {activeSection === "tags" && tags.length > 0 && (
          <ElementTable
            elements={tags}
            title="Tags Overview"
            icon="🏷️"
            id="tags"
          />
        )}
        {activeSection === "tags" && tags.length > 0 && (
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
