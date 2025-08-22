import React from "react";
import { Tag } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatSchema, formatId } from "../utils/formatting";
import "./TagCard.scss";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_TASK_FILE_QUERY,
  SAMPLE_RESOURCE_FILE_QUERY,
  SAMPLE_MIDDLEWARE_FILE_QUERY,
  SAMPLE_EVENT_FILE_QUERY,
} from "../utils/graphqlClient";

export interface TagCardProps {
  tag: Tag;
  introspector: Introspector;
}

export const TagCard: React.FC<TagCardProps> = ({ tag }) => {
  const allTaggedElements = [
    ...tag.tasks,
    ...tag.resources,
    ...tag.middlewares,
    ...tag.events,
    ...tag.hooks,
  ];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState<string>("");
  const [modalSubtitle, setModalSubtitle] = React.useState<string | undefined>(
    undefined
  );
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openElementFile(
    kind: "task" | "resource" | "middleware" | "event",
    id: string,
    title?: string | null,
    filePath?: string | null
  ) {
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    setModalTitle(title || formatId(id));
    setModalSubtitle(filePath || undefined);
    try {
      let data: any;
      if (kind === "task") {
        data = await graphqlRequest<{ task: { fileContents: string | null } }>(
          SAMPLE_TASK_FILE_QUERY,
          { id }
        );
        setFileContent(data?.task?.fileContents ?? null);
      } else if (kind === "resource") {
        data = await graphqlRequest<{
          resource: { fileContents: string | null };
        }>(SAMPLE_RESOURCE_FILE_QUERY, { id });
        setFileContent(data?.resource?.fileContents ?? null);
      } else if (kind === "middleware") {
        data = await graphqlRequest<{
          middleware: { fileContents: string | null };
        }>(SAMPLE_MIDDLEWARE_FILE_QUERY, { id });
        setFileContent(data?.middleware?.fileContents ?? null);
      } else if (kind === "event") {
        data = await graphqlRequest<{ event: { fileContents: string | null } }>(
          SAMPLE_EVENT_FILE_QUERY,
          { id }
        );
        setFileContent(data?.event?.fileContents ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${tag.id}`} className="tag-card">
      <div className="tag-card__header">
        <div className="tag-card__header-content">
          <div className="main">
            <h3 className="tag-card__title">🏷️ {formatId(tag.id)}</h3>
            <div className="tag-card__id">{tag.id}</div>
          </div>
        </div>
      </div>

      <div className="tag-card__content">
        <div className="tag-card__grid">
          <div>
            <div className="tag-card__section">
              <h4 className="tag-card__section__title">📋 Overview</h4>
              <div className="tag-card__section__content">
                <div className="tag-card__summary">
                  <div className="tag-card__total">
                    <span className="value">{allTaggedElements.length}</span>
                    <span className="label">Total Tagged Elements</span>
                  </div>
                </div>
                <div className="tag-card__stats">
                  <div className="tag-card__stat tag-card__stat--tasks">
                    <div className="tag-card__stat__value">
                      {tag.tasks.length}
                    </div>
                    <div className="tag-card__stat__label">Tasks</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--resources">
                    <div className="tag-card__stat__value">
                      {tag.resources.length}
                    </div>
                    <div className="tag-card__stat__label">Resources</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--events">
                    <div className="tag-card__stat__value">
                      {tag.events.length}
                    </div>
                    <div className="tag-card__stat__label">Events</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--middlewares">
                    <div className="tag-card__stat__value">
                      {tag.middlewares.length}
                    </div>
                    <div className="tag-card__stat__label">Middlewares</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--hooks">
                    <div className="tag-card__stat__value">
                      {tag.hooks.length}
                    </div>
                    <div className="tag-card__stat__label">Hooks</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="tag-card__section">
              <h4 className="tag-card__section__title">
                ⚙️ Configuration Schema
              </h4>
              <div className="tag-card__config">
                <pre className="tag-card__config__block">
                  {formatSchema(tag.configSchema)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {allTaggedElements.length > 0 && (
          <div className="tag-card__relations">
            <h4 className="tag-card__relations__title">🔗 Tagged Elements</h4>
            <div className="tag-card__relations__grid">
              {tag.tasks.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Tasks</h5>
                  <div className="tag-card__relations__items">
                    {tag.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="tag-card__relation-item tag-card__relation-item--task"
                      >
                        <a
                          href={`#element-${task.id}`}
                          className="tag-card__relation-link"
                        >
                          <div className="title title--task">
                            {task.meta?.title || formatId(task.id)}
                          </div>
                          <div className="id">{task.id}</div>
                        </a>
                        {task.filePath && (
                          <button
                            type="button"
                            title="View file"
                            onClick={() =>
                              openElementFile(
                                "task",
                                task.id,
                                task.meta?.title || null,
                                task.filePath
                              )
                            }
                            style={{
                              marginLeft: 8,
                              background: "transparent",
                              border: "none",
                              color: "#1976d2",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            View file
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tag.resources.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Resources</h5>
                  <div className="tag-card__relations__items">
                    {tag.resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="tag-card__relation-item tag-card__relation-item--resource"
                      >
                        <a
                          href={`#element-${resource.id}`}
                          className="tag-card__relation-link"
                        >
                          <div className="title title--resource">
                            {resource.meta?.title || formatId(resource.id)}
                          </div>
                          <div className="id">{resource.id}</div>
                        </a>
                        {resource.filePath && (
                          <button
                            type="button"
                            title="View file"
                            onClick={() =>
                              openElementFile(
                                "resource",
                                resource.id,
                                resource.meta?.title || null,
                                resource.filePath
                              )
                            }
                            style={{
                              marginLeft: 8,
                              background: "transparent",
                              border: "none",
                              color: "#2e7d32",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            View file
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tag.middlewares.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Middlewares</h5>
                  <div className="tag-card__relations__items">
                    {tag.middlewares.map((middleware) => (
                      <div
                        key={middleware.id}
                        className="tag-card__relation-item tag-card__relation-item--middleware"
                      >
                        <a
                          href={`#element-${middleware.id}`}
                          className="tag-card__relation-link"
                        >
                          <div className="title title--middleware">
                            {middleware.meta?.title || formatId(middleware.id)}
                          </div>
                          <div className="id">{middleware.id}</div>
                        </a>
                        {middleware.filePath && (
                          <button
                            type="button"
                            title="View file"
                            onClick={() =>
                              openElementFile(
                                "middleware",
                                middleware.id,
                                middleware.meta?.title || null,
                                middleware.filePath
                              )
                            }
                            style={{
                              marginLeft: 8,
                              background: "transparent",
                              border: "none",
                              color: "#7b1fa2",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            View file
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tag.events.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Events</h5>
                  <div className="tag-card__relations__items">
                    {tag.events.map((event) => (
                      <div
                        key={event.id}
                        className="tag-card__relation-item tag-card__relation-item--event"
                      >
                        <a
                          href={`#element-${event.id}`}
                          className="tag-card__relation-link"
                        >
                          <div className="title title--event">
                            {event.meta?.title || formatId(event.id)}
                          </div>
                          <div className="id">{event.id}</div>
                        </a>
                        {event.filePath && (
                          <button
                            type="button"
                            title="View file"
                            onClick={() =>
                              openElementFile(
                                "event",
                                event.id,
                                event.meta?.title || null,
                                event.filePath
                              )
                            }
                            style={{
                              marginLeft: 8,
                              background: "transparent",
                              border: "none",
                              color: "#f57c00",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            View file
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tag.hooks.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Hooks</h5>
                  <div className="tag-card__relations__items">
                    {tag.hooks.map((hook) => (
                      <a
                        key={hook.id}
                        href={`#element-${hook.id}`}
                        className="tag-card__relation-item tag-card__relation-item--hook tag-card__relation-link"
                      >
                        <div className="title title--hook">
                          {hook.meta?.title || formatId(hook.id)}
                        </div>
                        <div className="id">{hook.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CodeModal
        title={modalTitle}
        subtitle={modalSubtitle}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
      />
    </div>
  );
};
