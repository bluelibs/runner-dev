import React from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { Section } from "../Documentation";
import "./Sidebar.scss";

export interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  introspector: Introspector;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  introspector,
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
}) => {
  const sections = [
    { id: "overview" as Section, label: "Overview", icon: "📋" },
    {
      id: "tasks" as Section,
      label: "Tasks",
      icon: "⚙️",
      count: introspector.getTasks().length,
    },
    {
      id: "resources" as Section,
      label: "Resources",
      icon: "🔧",
      count: introspector.getResources().length,
    },
    {
      id: "hooks" as Section,
      label: "Hooks",
      icon: "🪝",
      count: introspector.getHooks().length,
    },
    {
      id: "events" as Section,
      label: "Events",
      icon: "📡",
      count: introspector.getEvents().length,
    },
    {
      id: "middlewares" as Section,
      label: "Middlewares",
      icon: "🔗",
      count: introspector.getMiddlewares().length,
    },
    {
      id: "tags" as Section,
      label: "Tags",
      icon: "🏷️",
      count: introspector.getAllTags().length,
    },
    { id: "diagnostics" as Section, label: "Diagnostics", icon: "🔍" },
  ];

  const diagnostics = introspector.getDiagnostics();
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning"
  ).length;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "300px",
        height: "100vh",
        background: "#2c3e50",
        color: "white",
        padding: "20px",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: "30px" }}>
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: "20px",
            color: "#ecf0f1",
            borderBottom: "2px solid #34495e",
            paddingBottom: "10px",
          }}
        >
          Runner Documentation
        </h2>

        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #34495e",
              borderRadius: "4px",
              background: "#34495e",
              color: "white",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {selectedTag && (
          <div
            style={{
              background: "#3498db",
              padding: "8px 12px",
              borderRadius: "4px",
              marginBottom: "15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px" }}>Tag: {selectedTag}</span>
            <button
              onClick={() => onTagChange(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "2px",
                fontSize: "12px",
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      <nav>
        {sections.map((section) => (
          <div
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              margin: "4px 0",
              borderRadius: "6px",
              cursor: "pointer",
              background:
                activeSection === section.id ? "#3498db" : "transparent",
              transition: "background-color 0.2s ease",
              borderLeft:
                activeSection === section.id
                  ? "4px solid #2980b9"
                  : "4px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (activeSection !== section.id) {
                e.currentTarget.style.background = "#34495e";
              }
            }}
            onMouseLeave={(e) => {
              if (activeSection !== section.id) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ marginRight: "10px", fontSize: "16px" }}>
                {section.icon}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                {section.label}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {section.count !== undefined && (
                <span
                  style={{
                    background:
                      activeSection === section.id ? "#2980b9" : "#7f8c8d",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {section.count}
                </span>
              )}

              {section.id === "diagnostics" &&
                (errorCount > 0 || warningCount > 0) && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {errorCount > 0 && (
                      <span
                        style={{
                          background: "#e74c3c",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: "bold",
                        }}
                      >
                        {errorCount}
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span
                        style={{
                          background: "#f39c12",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: "bold",
                        }}
                      >
                        {warningCount}
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>
        ))}
      </nav>

      {introspector.getAllTags().length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3
            style={{
              fontSize: "14px",
              color: "#bdc3c7",
              margin: "0 0 15px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Quick Tags
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {introspector
              .getAllTags()
              .slice(0, 8)
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() =>
                    onTagChange(selectedTag === tag.id ? null : tag.id)
                  }
                  style={{
                    background: selectedTag === tag.id ? "#e67e22" : "#7f8c8d",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTag !== tag.id) {
                      e.currentTarget.style.background = "#95a5a6";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTag !== tag.id) {
                      e.currentTarget.style.background = "#7f8c8d";
                    }
                  }}
                >
                  {tag.id}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
