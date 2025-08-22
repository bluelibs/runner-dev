import React from "react";
import { Tag } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatId,
} from "../utils/formatting";
import "./TagCard.scss";

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

  return (
    <div id={`element-${tag.id}`} className="tag-card">
      <div className="tag-card__header">
        <div className="tag-card__header-content">
          <div className="main">
            <h3 className="tag-card__title">
              🏷️ {formatId(tag.id)}
            </h3>
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
                <div className="tag-card__stats">
                  <div className="tag-card__stat tag-card__stat--tasks">
                    <div className="tag-card__stat__value">{tag.tasks.length}</div>
                    <div className="tag-card__stat__label">Tasks</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--resources">
                    <div className="tag-card__stat__value">{tag.resources.length}</div>
                    <div className="tag-card__stat__label">Resources</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--events">
                    <div className="tag-card__stat__value">{tag.events.length}</div>
                    <div className="tag-card__stat__label">Events</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--middlewares">
                    <div className="tag-card__stat__value">{tag.middlewares.length}</div>
                    <div className="tag-card__stat__label">Middlewares</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--hooks">
                    <div className="tag-card__stat__value">{tag.hooks.length}</div>
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
            <h4 className="tag-card__relations__title">
              🔗 Tagged Elements
            </h4>
            <div className="tag-card__relations__grid">
              {tag.tasks.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Tasks</h5>
                  <div className="tag-card__relations__items">
                    {tag.tasks.map((task) => (
                      <a
                        key={task.id}
                        href={`#element-${task.id}`}
                        className="tag-card__relation-item tag-card__relation-item--task tag-card__relation-link"
                      >
                        <div className="title title--task">
                          {task.meta?.title || formatId(task.id)}
                        </div>
                        <div className="id">{task.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {tag.resources.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Resources</h5>
                  <div className="tag-card__relations__items">
                    {tag.resources.map((resource) => (
                      <a
                        key={resource.id}
                        href={`#element-${resource.id}`}
                        className="tag-card__relation-item tag-card__relation-item--resource tag-card__relation-link"
                      >
                        <div className="title title--resource">
                          {resource.meta?.title || formatId(resource.id)}
                        </div>
                        <div className="id">{resource.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {tag.middlewares.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Middlewares</h5>
                  <div className="tag-card__relations__items">
                    {tag.middlewares.map((middleware) => (
                      <a
                        key={middleware.id}
                        href={`#element-${middleware.id}`}
                        className="tag-card__relation-item tag-card__relation-item--middleware tag-card__relation-link"
                      >
                        <div className="title title--middleware">
                          {middleware.meta?.title || formatId(middleware.id)}
                        </div>
                        <div className="id">{middleware.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {tag.events.length > 0 && (
                <div className="tag-card__relations__category">
                  <h5>Events</h5>
                  <div className="tag-card__relations__items">
                    {tag.events.map((event) => (
                      <a
                        key={event.id}
                        href={`#element-${event.id}`}
                        className="tag-card__relation-item tag-card__relation-item--event tag-card__relation-link"
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
    </div>
  );
};
