import React, { useState } from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  getSeverityIcon,
  formatId,
} from "../utils/formatting";
import "./DiagnosticsPanel.scss";
export interface DiagnosticsPanelProps {
  introspector: Introspector;
  detailed?: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  introspector,
  detailed = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("summary");

  const diagnostics = introspector.getDiagnostics();
  const orphanEvents = introspector.getOrphanEvents();
  const unemittedEvents = introspector.getUnemittedEvents();
  const unusedMiddleware = introspector.getUnusedMiddleware();
  const overrideConflicts = introspector.getOverrideConflicts();

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning"
  ).length;
  const infoCount = diagnostics.filter((d) => d.severity === "info").length;

  const categories = [
    { id: "summary", label: "Summary", count: diagnostics.length },
    { id: "errors", label: "Errors", count: errorCount },
    { id: "warnings", label: "Warnings", count: warningCount },
    { id: "orphans", label: "Orphan Events", count: orphanEvents.length },
    {
      id: "unemitted",
      label: "Unemitted Events",
      count: unemittedEvents.length,
    },
    {
      id: "unused",
      label: "Unused Middleware",
      count: unusedMiddleware.length,
    },
    {
      id: "conflicts",
      label: "Override Conflicts",
      count: overrideConflicts.length,
    },
  ];

  const renderSummaryCard = (
    title: string,
    count: number,
    _color: string,
    icon: string,
    description: string,
    className?: string
  ) => (
    <div className={`diagnostics-panel__summary-card ${className || ''}`}>
      <div className="diagnostics-panel__summary-card__header">
        <span className="icon">{icon}</span>
        <h4>{title}</h4>
      </div>
      <div className="diagnostics-panel__summary-card__value">
        {count}
      </div>
      <div className="diagnostics-panel__summary-card__description">{description}</div>
    </div>
  );

  const renderDiagnosticItem = (diagnostic: any) => (
    <div
      key={`${diagnostic.code}-${diagnostic.nodeId || "global"}`}
      className={`diagnostics-panel__item diagnostics-panel__item--${diagnostic.severity}`}
    >
      <div className="diagnostics-panel__item-content">
        <span className="icon">
          {getSeverityIcon(diagnostic.severity)}
        </span>
        <div className="main">
          <div className="diagnostics-panel__item-header">
            <span className={`diagnostics-panel__severity-badge diagnostics-panel__severity-badge--${diagnostic.severity}`}>
              {diagnostic.severity}
            </span>
            <span className="diagnostics-panel__code-badge">
              {diagnostic.code}
            </span>
          </div>
          <div className="diagnostics-panel__message">
            {diagnostic.message}
          </div>
          {diagnostic.nodeId && (
            <div className="diagnostics-panel__node-info">
              <div>
                <strong>Node:</strong> {formatId(diagnostic.nodeId)}
              </div>
              {diagnostic.nodeKind && (
                <div>
                  <strong>Type:</strong> {diagnostic.nodeKind}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSpecialItems = (
    items: any[],
    title: string,
    icon: string,
    _color: string,
    getItemId: (item: any) => string,
    getItemTitle?: (item: any) => string,
    className?: string
  ) => (
    <div className="diagnostics-panel__special-section">
      <h4>
        <span className="icon">{icon}</span>
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <div className="diagnostics-panel__empty-state">
          <div className="celebration">🎉</div>
          No {title.toLowerCase()} found. Great job!
        </div>
      ) : (
        <div className="diagnostics-panel__special-section__items">
          {items.map((item, index) => (
            <div
              key={index}
              className={`diagnostics-panel__special-section__item ${className || ''}`}
            >
              <div className="title">
                {getItemTitle ? getItemTitle(item) : formatId(getItemId(item))}
              </div>
              <div className="id">
                {getItemId(item)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!detailed) {
    return (
      <div className="diagnostics-panel__summary-grid">
        {renderSummaryCard(
          "Errors",
          errorCount,
          "#dc3545",
          "❌",
          "Critical issues",
          "diagnostics-panel__summary-card--errors"
        )}
        {renderSummaryCard(
          "Warnings",
          warningCount,
          "#ffc107",
          "⚠️",
          "Potential problems",
          "diagnostics-panel__summary-card--warnings"
        )}
        {renderSummaryCard(
          "Orphan Events",
          orphanEvents.length,
          "#6f42c1",
          "👻",
          "Events with no listeners",
          "diagnostics-panel__summary-card--orphans"
        )}
        {renderSummaryCard(
          "Unused Middleware",
          unusedMiddleware.length,
          "#fd7e14",
          "🔗",
          "Middleware not in use",
          "diagnostics-panel__summary-card--unused"
        )}
        {renderSummaryCard(
          "Override Conflicts",
          overrideConflicts.length,
          "#dc3545",
          "⚔️",
          "Resource override issues",
          "diagnostics-panel__summary-card--conflicts"
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="diagnostics-panel__tabs">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`diagnostics-panel__tab ${
              activeCategory === category.id ? 'diagnostics-panel__tab--active' : ''
            }`}
          >
            {category.label}
            {category.count > 0 && (
              <span className="diagnostics-panel__tab-count">
                {category.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeCategory === "summary" && (
        <div>
          <div className="diagnostics-panel__detailed-grid">
            {renderSummaryCard(
              "Total Issues",
              diagnostics.length,
              "#6c757d",
              "📊",
              "All diagnostic items",
              "diagnostics-panel__summary-card--total"
            )}
            {renderSummaryCard(
              "Errors",
              errorCount,
              "#dc3545",
              "❌",
              "Critical issues requiring attention",
              "diagnostics-panel__summary-card--errors"
            )}
            {renderSummaryCard(
              "Warnings",
              warningCount,
              "#ffc107",
              "⚠️",
              "Potential problems to review",
              "diagnostics-panel__summary-card--warnings"
            )}
            {renderSummaryCard(
              "Information",
              infoCount,
              "#17a2b8",
              "ℹ️",
              "Informational messages",
              "diagnostics-panel__summary-card--info"
            )}
          </div>

          {diagnostics.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 15px 0", color: "#495057" }}>
                Recent Diagnostics
              </h4>
              <div className="diagnostics-panel__items">
                {diagnostics.slice(0, 5).map(renderDiagnosticItem)}
                {diagnostics.length > 5 && (
                  <div className="diagnostics-panel__view-all">
                    <button
                      onClick={() => setActiveCategory("errors")}
                    >
                      View All {diagnostics.length} Diagnostics
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeCategory === "errors" && (
        <div>
          <div className="diagnostics-panel__items">
            {diagnostics
              .filter((d) => d.severity === "error")
              .map(renderDiagnosticItem)}
            {errorCount === 0 && (
              <div className="diagnostics-panel__success-state">
                <div className="icon">✅</div>
                <h4>No Errors Found!</h4>
                <p>Your application has no critical errors.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategory === "warnings" && (
        <div>
          <div className="diagnostics-panel__items">
            {diagnostics
              .filter((d) => d.severity === "warning")
              .map(renderDiagnosticItem)}
            {warningCount === 0 && (
              <div className="diagnostics-panel__success-state" style={{ background: "#fff3cd", border: "1px solid #ffeaa7" }}>
                <div className="icon">👍</div>
                <h4 style={{ color: "#856404" }}>No Warnings!</h4>
                <p style={{ color: "#856404" }}>No potential issues detected.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeCategory === "orphans" &&
        renderSpecialItems(
          orphanEvents,
          "Orphan Events",
          "👻",
          "#6f42c1",
          (item) => item.id,
          (item) => `${formatId(item.id)} (No listeners)`,
          "diagnostics-panel__special-section__item--orphan"
        )}

      {activeCategory === "unemitted" &&
        renderSpecialItems(
          unemittedEvents,
          "Unemitted Events",
          "📤",
          "#fd7e14",
          (item) => item.id,
          (item) => `${formatId(item.id)} (No emitters)`,
          "diagnostics-panel__special-section__item--unused"
        )}

      {activeCategory === "unused" &&
        renderSpecialItems(
          unusedMiddleware,
          "Unused Middleware",
          "🔗",
          "#6c757d",
          (item) => item.id,
          (item) => `${formatId(item.id)} (Not used)`,
          "diagnostics-panel__special-section__item--unused"
        )}

      {activeCategory === "conflicts" &&
        renderSpecialItems(
          overrideConflicts,
          "Override Conflicts",
          "⚔️",
          "#dc3545",
          (item) => item.targetId,
          (item) =>
            `${formatId(item.targetId)} ← overridden by → ${formatId(item.by)}`,
          "diagnostics-panel__special-section__item--conflict"
        )}
    </div>
  );
};
