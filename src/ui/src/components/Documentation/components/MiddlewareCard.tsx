import React from "react";
import { Middleware } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import { TagsSection } from "./TagsSection";
import "./MiddlewareCard.scss";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_MIDDLEWARE_FILE_QUERY,
} from "../utils/graphqlClient";

export interface MiddlewareCardProps {
  middleware: Middleware;
  introspector: Introspector;
}

export const MiddlewareCard: React.FC<MiddlewareCardProps> = ({
  middleware,
  introspector,
}) => {
  const taskUsages = introspector.getTasksUsingMiddlewareDetailed(
    middleware.id
  );
  const resourceUsages = introspector.getResourcesUsingMiddlewareDetailed(
    middleware.id
  );
  const emittedEvents = introspector.getMiddlewareEmittedEvents(middleware.id);

  const getMiddlewareTypeIcon = () => {
    if (middleware.global?.enabled) return "🌐";
    if (middleware.type === "task") return "⚙️";
    if (middleware.type === "resource") return "🔧";
    return "🔗";
  };

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!middleware?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        middleware: { fileContents: string | null };
      }>(SAMPLE_MIDDLEWARE_FILE_QUERY, { id: middleware.id });
      setFileContent(data?.middleware?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${middleware.id}`} className="middleware-card">
      <div className="middleware-card__header">
        <div className="middleware-card__header-content">
          <div className="main">
            <h3 className="middleware-card__title">
              {getMiddlewareTypeIcon()}{" "}
              {middleware.meta?.title || formatId(middleware.id)}
            </h3>
            <div className="middleware-card__id">{middleware.id}</div>
            {middleware.meta?.description && (
              <p className="middleware-card__description">
                {middleware.meta.description}
              </p>
            )}

            {middleware.global?.enabled && (
              <div className="middleware-card__global-badges">
                <span className="middleware-card__global-badge">🌐 Global</span>
                {middleware.global.tasks && (
                  <span className="middleware-card__global-badge">Tasks</span>
                )}
                {middleware.global.resources && (
                  <span className="middleware-card__global-badge">
                    Resources
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="meta">
            <div
              className={`middleware-card__type-badge middleware-card__type-badge--${middleware.type}`}
            >
              {middleware.type === "task" ? "⚙️ Task" : "🔧 Resource"}
            </div>
            {middleware.tags && middleware.tags.length > 0 && (
              <div className="middleware-card__tags">
                {middleware.tags.map((tag) => (
                  <span key={tag} className="middleware-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="middleware-card__content">
        <div className="middleware-card__grid">
          <div className="middleware-card__section">
            <h4 className="middleware-card__section__title">📋 Overview</h4>
            <div className="middleware-card__section__content">
              <div className="middleware-card__info-block">
                <div className="label">File Path:</div>
                <div className="value">
                  {middleware.filePath ? (
                    <button
                      type="button"
                      onClick={openFileModal}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#7b1fa2",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                        fontFamily: "inherit",
                        fontSize: "inherit",
                      }}
                      title="View file contents"
                    >
                      {formatFilePath(middleware.filePath)}
                    </button>
                  ) : (
                    formatFilePath(middleware.filePath)
                  )}
                </div>
              </div>

              {middleware.registeredBy && (
                <div className="middleware-card__info-block">
                  <div className="label">Registered By:</div>
                  <div className="value">
                    <a
                      href={`#element-${middleware.registeredBy}`}
                      className="middleware-card__registrar-link"
                    >
                      {middleware.registeredBy}
                    </a>
                  </div>
                </div>
              )}

              <div className="middleware-card__info-block">
                <div className="label">Usage Statistics:</div>
                <div className="middleware-card__usage-stats">
                  <div className="middleware-card__usage-stat middleware-card__usage-stat--tasks">
                    <div className="value value--tasks">
                      {taskUsages.length}
                    </div>
                    <div className="label label--tasks">Tasks</div>
                  </div>
                  <div className="middleware-card__usage-stat middleware-card__usage-stat--resources">
                    <div className="value value--resources">
                      {resourceUsages.length}
                    </div>
                    <div className="label label--resources">Resources</div>
                  </div>
                  <div className="middleware-card__usage-stat middleware-card__usage-stat--events">
                    <div className="value value--events">
                      {emittedEvents.length}
                    </div>
                    <div className="label label--events">Events</div>
                  </div>
                </div>
              </div>

              {middleware.global?.enabled && (
                <div className="middleware-card__global-config">
                  <div className="title">
                    🌐 Global Middleware Configuration
                  </div>
                  <div className="content">
                    <div className="config-item">
                      <strong>Tasks:</strong>{" "}
                      {middleware.global.tasks ? "Enabled" : "Disabled"}
                    </div>
                    <div className="config-item">
                      <strong>Resources:</strong>{" "}
                      {middleware.global.resources ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
              )}

              {middleware.overriddenBy && (
                <div className="middleware-card__alert middleware-card__alert--warning">
                  <div className="title">⚠️ Overridden By:</div>
                  <div className="content">{middleware.overriddenBy}</div>
                </div>
              )}
            </div>
          </div>

          <div className="middleware-card__section">
            <h4 className="middleware-card__section__title">
              📝 Configuration Schema
            </h4>
            <pre className="middleware-card__code-block">
              {formatSchema(middleware.configSchema)}
            </pre>
          </div>

          {(taskUsages.length > 0 || resourceUsages.length > 0) && (
            <div className="middleware-card__usage-details">
              <h4 className="middleware-card__usage-details__title">
                🔗 Usage Details
              </h4>
              <div className="middleware-card__usage-details__grid">
                {taskUsages.length > 0 && (
                  <div className="middleware-card__usage-details__category">
                    <h5>Used by Tasks</h5>
                    <div className="middleware-card__usage-details__items">
                      {taskUsages.map((usage) => (
                        <a
                          key={usage.id}
                          href={`#element-${usage.id}`}
                          className="middleware-card__usage-item middleware-card__usage-link"
                        >
                          <div className="middleware-card__usage-item__header">
                            <div className="main">
                              <div className="title">
                                {usage.node.meta?.title || formatId(usage.id)}
                              </div>
                              <div className="id">{usage.id}</div>
                            </div>
                            {usage.config && (
                              <span className="configured-badge configured-badge--task">
                                Configured
                              </span>
                            )}
                          </div>
                          {usage.config && (
                            <div className="middleware-card__usage-item__config">
                              <div className="config-title">Configuration:</div>
                              <pre className="config-code">{usage.config}</pre>
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {resourceUsages.length > 0 && (
                  <div className="middleware-card__usage-details__category">
                    <h5>Used by Resources</h5>
                    <div className="middleware-card__usage-details__items">
                      {resourceUsages.map((usage) => (
                        <a
                          key={usage.id}
                          href={`#element-${usage.id}`}
                          className="middleware-card__usage-item middleware-card__usage-link"
                        >
                          <div className="middleware-card__usage-item__header">
                            <div className="main">
                              <div className="title">
                                {usage.node.meta?.title || formatId(usage.id)}
                              </div>
                              <div className="id">{usage.id}</div>
                            </div>
                            {usage.config && (
                              <span className="configured-badge configured-badge--resource">
                                Configured
                              </span>
                            )}
                          </div>
                          {usage.config && (
                            <div className="middleware-card__usage-item__config">
                              <div className="config-title">Configuration:</div>
                              <pre className="config-code">{usage.config}</pre>
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {emittedEvents.length > 0 && (
            <div className="middleware-card__events">
              <h4 className="middleware-card__events__title">
                📡 Events Emitted by Usage
              </h4>
              <div className="middleware-card__events__items">
                {emittedEvents.map((event) => (
                  <a
                    key={event.id}
                    href={`#element-${event.id}`}
                    className="middleware-card__event-item middleware-card__event-link"
                  >
                    <div className="title">
                      {event.meta?.title || formatId(event.id)}
                    </div>
                    <div className="id">{event.id}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {taskUsages.length === 0 && resourceUsages.length === 0 && (
            <div className="middleware-card__empty-state">
              This middleware is not currently used by any tasks or resources.
            </div>
          )}

          <TagsSection
            element={middleware}
            introspector={introspector}
            className="middleware-card__tags-section"
          />
        </div>
      </div>

      <CodeModal
        title={middleware.meta?.title || formatId(middleware.id)}
        subtitle={middleware.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
      />
    </div>
  );
};
