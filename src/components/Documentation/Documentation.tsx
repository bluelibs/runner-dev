import React from "react";
import { Introspector } from "../../resources/introspector.resource";
import { TaskCard } from "./components/TaskCard";
import { ResourceCard } from "./components/ResourceCard";
import { MiddlewareCard } from "./components/MiddlewareCard";
import { EventCard } from "./components/EventCard";
import { HookCard } from "./components/HookCard";
import { TagCard } from "./components/TagCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";

// jQuery type declaration for server-side rendering
declare global {
  interface Window {
    jQuery: any;
  }
}

export interface DocumentationProps {
  introspector: Introspector;
  namespacePrefix?: string;
}

export const Documentation: React.FC<DocumentationProps> = ({
  introspector,
  namespacePrefix,
}) => {
  const filterByNamespace = (items: any[]) => {
    if (!namespacePrefix) return items;
    return items.filter(item => item.id.startsWith(namespacePrefix));
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
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#f8f9fa",
        minHeight: "100vh",
        display: "flex",
      }}
    >
      {/* Fixed Navigation Sidebar */}
      <nav
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "280px",
          height: "100vh",
          background: "linear-gradient(180deg, #2c3e50 0%, #34495e 100%)",
          color: "white",
          padding: "30px 20px",
          overflowY: "auto",
          zIndex: 1000,
          boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ marginBottom: "40px" }}>
          <h2
            style={{
              margin: "0 0 10px 0",
              fontSize: "20px",
              color: "#ecf0f1",
              borderBottom: "3px solid #3498db",
              paddingBottom: "12px",
              fontWeight: "700",
            }}
          >
            📚 Documentation
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              opacity: 0.8,
              lineHeight: "1.4",
            }}
          >
            Navigate through your application components
          </p>
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          <li style={{ marginBottom: "8px" }}>
            <a
              href="#top"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderRadius: "8px",
                textDecoration: "none",
                color: "white",
                transition: "all 0.3s ease",
                background: "rgba(52, 152, 219, 0.15)",
                border: "1px solid rgba(52, 152, 219, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(52, 152, 219, 0.25)";
                e.currentTarget.style.borderColor = "#3498db";
                e.currentTarget.style.transform = "translateX(4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(52, 152, 219, 0.15)";
                e.currentTarget.style.borderColor = "rgba(52, 152, 219, 0.3)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <span style={{ fontSize: "16px" }}>🏠</span>
                <span style={{ fontSize: "14px", fontWeight: "600" }}>
                  Home
                </span>
              </div>
            </a>
          </li>
          {sections.map((section) => (
            <li key={section.id} style={{ marginBottom: "8px" }}>
              <a
                href={`#${section.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: "white",
                  transition: "all 0.3s ease",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(52, 152, 219, 0.2)";
                  e.currentTarget.style.borderColor = "#3498db";
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span style={{ fontSize: "16px" }}>{section.icon}</span>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>
                    {section.label}
                  </span>
                </div>
                {section.count !== null && (
                  <span
                    style={{
                      background: "rgba(52, 152, 219, 0.3)",
                      color: "#3498db",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      border: "1px solid rgba(52, 152, 219, 0.5)",
                    }}
                  >
                    {section.count}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginTop: "40px",
            padding: "20px",
            background: "rgba(52, 152, 219, 0.1)",
            borderRadius: "8px",
            border: "1px solid rgba(52, 152, 219, 0.2)",
          }}
        >
          <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>
            Quick Stats
          </div>
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#3498db" }}
          >
            {tasks.length +
              resources.length +
              events.length +
              hooks.length +
              middlewares.length}
          </div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>Total Components</div>
        </div>
      </nav>

      {/* Main Content */}
      <div
        style={{
          marginLeft: "280px",
          flex: 1,
          padding: "40px",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <header
            id="top"
            style={{
              textAlign: "center",
              marginBottom: "50px",
              background: "linear-gradient(135deg, #007acc, #0056b3)",
              color: "white",
              padding: "40px",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,122,204,0.3)",
            }}
          >
            <h1
              style={{
                margin: "0 0 10px 0",
                fontSize: "36px",
                fontWeight: "700",
              }}
            >
              Runner Application Documentation
            </h1>
            <p style={{ margin: 0, fontSize: "18px", opacity: 0.9 }}>
              Complete overview of your application's architecture and
              components
            </p>
          </header>

          <section
            id="overview"
            style={{ marginBottom: "50px", scrollMarginTop: "20px" }}
          >
            <h2
              style={{
                fontSize: "28px",
                marginBottom: "30px",
                color: "#2c3e50",
              }}
            >
              📋 Overview
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "25px",
              }}
            >
              <div
                style={{
                  padding: "30px",
                  background: "linear-gradient(135deg, #007acc, #0056b3)",
                  color: "white",
                  borderRadius: "12px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(0,122,204,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
                  Tasks
                </h3>
                <div style={{ fontSize: "36px", fontWeight: "bold" }}>
                  {tasks.length}
                </div>
              </div>
              <div
                style={{
                  padding: "30px",
                  background: "linear-gradient(135deg, #28a745, #1e7e34)",
                  color: "white",
                  borderRadius: "12px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(40,167,69,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
                  Resources
                </h3>
                <div style={{ fontSize: "36px", fontWeight: "bold" }}>
                  {resources.length}
                </div>
              </div>
              <div
                style={{
                  padding: "30px",
                  background: "linear-gradient(135deg, #ffc107, #e0a800)",
                  color: "white",
                  borderRadius: "12px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(255,193,7,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
                  Events
                </h3>
                <div style={{ fontSize: "36px", fontWeight: "bold" }}>
                  {events.length}
                </div>
              </div>
              <div
                style={{
                  padding: "30px",
                  background: "linear-gradient(135deg, #6f42c1, #563d7c)",
                  color: "white",
                  borderRadius: "12px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(111,66,193,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
                  Middlewares
                </h3>
                <div style={{ fontSize: "36px", fontWeight: "bold" }}>
                  {middlewares.length}
                </div>
              </div>
              <div
                style={{
                  padding: "30px",
                  background: "linear-gradient(135deg, #9c27b0, #673ab7)",
                  color: "white",
                  borderRadius: "12px",
                  textAlign: "center",
                  boxShadow: "0 4px 20px rgba(156,39,176,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 15px 0", fontSize: "18px" }}>
                  Hooks
                </h3>
                <div style={{ fontSize: "36px", fontWeight: "bold" }}>
                  {hooks.length}
                </div>
              </div>
            </div>
          </section>

          <section
            id="diagnostics"
            style={{ marginBottom: "50px", scrollMarginTop: "20px" }}
          >
            <h2
              style={{
                fontSize: "28px",
                marginBottom: "30px",
                color: "#2c3e50",
              }}
            >
              🔍 Diagnostics
            </h2>
            <DiagnosticsPanel introspector={introspector} detailed />
          </section>

          {tasks.length > 0 && (
            <section
              id="tasks"
              style={{ marginBottom: "60px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                ⚙️ Tasks ({tasks.length})
              </h2>
              <div style={{ display: "grid", gap: "30px" }}>
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
            <section
              id="resources"
              style={{ marginBottom: "60px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                🔧 Resources ({resources.length})
              </h2>
              <div style={{ display: "grid", gap: "30px" }}>
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
            <section
              id="events"
              style={{ marginBottom: "60px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                📡 Events ({events.length})
              </h2>
              <div style={{ display: "grid", gap: "30px" }}>
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
            <section
              id="hooks"
              style={{ marginBottom: "60px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                🪝 Hooks ({hooks.length})
              </h2>
              <div style={{ display: "grid", gap: "30px" }}>
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
            <section
              id="middlewares"
              style={{ marginBottom: "60px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                🔗 Middlewares ({middlewares.length})
              </h2>
              <div style={{ display: "grid", gap: "30px" }}>
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
            <section
              id="tags"
              style={{ marginBottom: "50px", scrollMarginTop: "20px" }}
            >
              <h2
                style={{
                  fontSize: "28px",
                  marginBottom: "30px",
                  color: "#2c3e50",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                🏷️ Tags ({tags.length})
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "25px",
                }}
              >
                {tags.map((tag) => (
                  <TagCard
                    key={tag.id}
                    tag={tag}
                    introspector={introspector}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
