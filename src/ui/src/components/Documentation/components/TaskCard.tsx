import React from "react";
import { Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import { TagsSection } from "./TagsSection";
import "./TaskCard.scss";
export interface TaskCardProps {
  task: Task;
  introspector: Introspector;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, introspector }) => {
  const dependencies = introspector.getDependencies(task);
  const middlewareUsages = introspector.getMiddlewareUsagesForTask(task.id);
  const emittedEvents = introspector.getEmittedEvents(task);

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
              {task.tags.map((tag) => (
                <span key={tag} className="task-card__tag">
                  {tag}
                </span>
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
                  <div className="value">{formatFilePath(task.filePath)}</div>
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
                  <div className="value">{formatArray(task.emits)}</div>
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
              <h4 className="task-card__section__title">📝 Schema</h4>
              <pre className="task-card__code-block">
                {formatSchema(task.inputSchema)}
              </pre>
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
    </div>
  );
};
