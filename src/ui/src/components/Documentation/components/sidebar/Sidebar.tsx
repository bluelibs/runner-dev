import React from "react";
import { Introspector } from "../../../../../../resources/models/Introspector";
import { Section } from "../../Documentation";
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
    <div className="sidebar">
      <div className="sidebar__header">
        <h2 className="sidebar__title">Runner Documentation</h2>

        <div className="sidebar__search">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="sidebar__search-input"
          />
        </div>

        {selectedTag && (
          <div className="sidebar__tag-filter">
            <span className="sidebar__tag-filter__label">
              Tag: {selectedTag}
            </span>
            <button
              onClick={() => onTagChange(null)}
              className="sidebar__tag-filter__clear"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`sidebar__nav-item ${
              activeSection === section.id ? "sidebar__nav-item--active" : ""
            }`}
          >
            <div className="sidebar__nav-item__content">
              <span className="icon">{section.icon}</span>
              <span className="label">{section.label}</span>
            </div>

            <div className="sidebar__nav-item__badges">
              {section.count !== undefined && (
                <span
                  className={`sidebar__count-badge ${
                    activeSection === section.id
                      ? "sidebar__count-badge--active"
                      : "sidebar__count-badge--inactive"
                  }`}
                >
                  {section.count}
                </span>
              )}

              {section.id === "diagnostics" &&
                (errorCount > 0 || warningCount > 0) && (
                  <div className="sidebar__diagnostic-badges">
                    {errorCount > 0 && (
                      <span className="sidebar__diagnostic-badge sidebar__diagnostic-badge--error">
                        {errorCount}
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="sidebar__diagnostic-badge sidebar__diagnostic-badge--warning">
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
        <div className="sidebar__quick-tags">
          <h3 className="sidebar__quick-tags__title">Quick Tags</h3>
          <div className="sidebar__quick-tags__container">
            {introspector
              .getAllTags()
              .slice(0, 8)
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() =>
                    onTagChange(selectedTag === tag.id ? null : tag.id)
                  }
                  className={`sidebar__quick-tags__tag ${
                    selectedTag === tag.id
                      ? "sidebar__quick-tags__tag--selected"
                      : "sidebar__quick-tags__tag--unselected"
                  }`}
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
