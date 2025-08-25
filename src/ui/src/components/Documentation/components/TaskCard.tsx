import React from "react";
import { Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import { graphqlRequest, SAMPLE_TASK_FILE_QUERY } from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./TaskCard.scss";
import { SchemaRenderer } from "./SchemaRenderer";
export interface TaskCardProps {
  task: Task;
  introspector: Introspector;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, introspector }) => {
  const dependencies = introspector.getDependencies(task);
  const middlewareUsages = introspector.getMiddlewareUsagesForTask(task.id);
  const emittedEvents = introspector.getEmittedEvents(task);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!task?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        task: { fileContents: string | null };
      }>(SAMPLE_TASK_FILE_QUERY, { id: task.id });
      setFileContent(data?.task?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${task.id}`} className="task-card">
      <div className="task-card__header">
        <div className="task-card__header-content">
          <div className="main">
            <h3 className="task-card__title">
              ⚙️ {task.meta?.title || formatId(task.id)}
            </h3>
            <div className="task-card__id">{task.id}</div>
            {task.meta?.description && (
              <p className="task-card__description">{task.meta.description}</p>
            )}
          </div>
          {task.tags && task.tags.length > 0 && (
            <div className="task-card__tags">
              {introspector.getTagsByIds(task.tags).map((tag) => (
                <a
                  href={`#element-${tag.id}`}
                  key={tag.id}
                  className="clean-button"
                >
                  {formatId(tag.id)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="task-card__content">
        <div className="task-card__grid">
          <div>
            <div className="task-card__section">
              <h4 className="task-card__section__title">📋 Overview</h4>
              <div className="task-card__section__content">
                <div className="task-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {task.filePath ? (
                      <button
                        type="button"
                        onClick={openFileModal}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#0056b3",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          fontFamily: "inherit",
                          fontSize: "inherit",
                        }}
                        title="View file contents"
                      >
                        {formatFilePath(task.filePath)}
                      </button>
                    ) : (
                      formatFilePath(task.filePath)
                    )}
                  </div>
                </div>

                {task.registeredBy && (
                  <div className="task-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${task.registeredBy}`}
                        className="task-card__registrar-link"
                      >
                        {task.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                <div className="task-card__info-block">
                  <div className="label">Emits Events:</div>
                  <div className="value">
                    {task.emits && task.emits.length > 0 ? (
                      <div className="task-card__emits-events">
                        {task.emits.map((eventName) => {
                          const event = introspector.getEvent(eventName);
                          return event ? (
                            <a
                              key={eventName}
                              href={`#element-${event.id}`}
                              className="task-card__emit-event-link"
                            >
                              {eventName}
                            </a>
                          ) : (
                            <span
                              key={eventName}
                              className="task-card__emit-event-text"
                            >
                              {eventName}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="task-card__no-events">None</span>
                    )}
                  </div>
                </div>

                {task.overriddenBy && (
                  <div className="task-card__alert task-card__alert--warning">
                    <div className="title">⚠️ Overridden By:</div>
                    <div className="content">{task.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="task-card__section">
              <h4 className="task-card__section__title">📝 Input Schema</h4>
              <div className="task-card__config">
                <SchemaRenderer schemaString={task.inputSchema} />
              </div>
            </div>
          </div>
        </div>

        {(dependencies.tasks.length > 0 ||
          dependencies.resources.length > 0 ||
          emittedEvents.length > 0) && (
          <div className="task-card__relations">
            <h4 className="task-card__relations__title">
              🔗 Dependencies & Relations
            </h4>
            <div className="task-card__relations__grid">
              {dependencies.tasks.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Task Dependencies</h5>
                  <div className="task-card__relations__items">
                    {dependencies.tasks.map((dep) => (
                      <a
                        key={dep.id}
                        href={`#element-${dep.id}`}
                        className="task-card__relation-item task-card__relation-item--task task-card__relation-link"
                      >
                        <div className="title title--task">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Resource Dependencies</h5>
                  <div className="task-card__relations__items">
                    {dependencies.resources.map((dep) => (
                      <a
                        key={dep.id}
                        href={`#element-${dep.id}`}
                        className="task-card__relation-item task-card__relation-item--resource task-card__relation-link"
                      >
                        <div className="title title--resource">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Emitted Events</h5>
                  <div className="task-card__relations__items">
                    {emittedEvents.map((event) => (
                      <a
                        key={event.id}
                        href={`#element-${event.id}`}
                        className="task-card__relation-item task-card__relation-item--event task-card__relation-link"
                      >
                        <div className="title title--event">
                          {event.meta?.title || formatId(event.id)}
                        </div>
                        <div className="id">{event.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {middlewareUsages.length > 0 && (
          <div className="task-card__middleware">
            <h4 className="task-card__middleware__title">
              🔗 Middleware Configuration
            </h4>
            <div className="task-card__middleware__items">
              {middlewareUsages.map((usage) => (
                <div key={usage.id} className="task-card__middleware__item">
                  <a
                    href={`#element-${usage.id}`}
                    className="task-card__middleware-link"
                  >
                    <div className="title">
                      {usage.node.meta?.title || formatId(usage.id)}
                    </div>
                    <div className="id">{usage.id}</div>
                  </a>
                  {usage.config && (
                    <div>
                      <div className="config-title">Configuration:</div>
                      <pre className="config-block">{usage.config}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <TagsSection
          element={task}
          introspector={introspector}
          className="task-card__tags-section"
        />
      </div>

      <CodeModal
        title={task.meta?.title || formatId(task.id)}
        subtitle={task.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(task.filePath)}
        saveOnFile={task.filePath || null}
      />
    </div>
  );
};
