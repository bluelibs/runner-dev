import React from "react";
import { Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
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
    <div
      className="task-card"
      onClick={() => {
        alert("aaaa");
      }}
    >
      <div className="task-card__header">
        <div className="task-card__header-content">
          <div className="main">
            <h3 className="task-card__title">
              ⚙️ {task.meta?.title || formatId(task.id)}
            </h3>
            <div className="task-card__id">{task.id}</div>
            {task.meta?.description && (
              <p className="task-card__description">
                {task.meta.description}
              </p>
            )}
          </div>
          {task.meta?.tags && task.meta.tags.length > 0 && (
            <div className="task-card__tags">
              {task.meta.tags.map((tag) => (
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
                    <div className="value">{task.registeredBy}</div>
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
                      <div key={dep.id} className="task-card__relation-item task-card__relation-item--task">
                        <div className="title title--task">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Resource Dependencies</h5>
                  <div className="task-card__relations__items">
                    {dependencies.resources.map((dep) => (
                      <div key={dep.id} className="task-card__relation-item task-card__relation-item--resource">
                        <div className="title title--resource">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Emitted Events</h5>
                  <div className="task-card__relations__items">
                    {emittedEvents.map((event) => (
                      <div key={event.id} className="task-card__relation-item task-card__relation-item--event">
                        <div className="title title--event">
                          {event.meta?.title || formatId(event.id)}
                        </div>
                        <div className="id">{event.id}</div>
                      </div>
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
                  <div className="title">
                    {usage.node.meta?.title || formatId(usage.id)}
                  </div>
                  <div className="id">{usage.id}</div>
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
      </div>
    </div>
  );
};
