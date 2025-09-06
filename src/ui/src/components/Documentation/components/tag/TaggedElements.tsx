import React from "react";
import { Tag } from "../../../../../../schema/model";
import { Introspector } from "../../../../../../resources/models/Introspector";
import { formatId } from "../../utils/formatting";

export interface TaggedElementsProps {
  tag: Tag;
  introspector: Introspector;
}

export const TaggedElements: React.FC<TaggedElementsProps> = ({ tag, introspector }) => {
  const allTaggedElements = [
    ...tag.tasks,
    ...tag.resources,
    ...tag.middlewares,
    ...tag.events,
    ...tag.hooks,
  ];

  if (allTaggedElements.length === 0) {
    return null;
  }

  return (
    <div className="tag-card__relations">
      <h4 className="tag-card__relations__title">🔗 Tagged Elements</h4>
      <div className="tag-card__relations__grid">
        {tag.tasks.length > 0 && (
          <div className="tag-card__relations__category">
            <h5>Tasks</h5>
            <div className="tag-card__relations__items">
              {tag.tasks.map((task) => {
                const config = task.tagsDetailed?.find((t) => t.id === tag.id)?.config;
                return (
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
                    {config && (
                      <div className="tag-card__relation-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tag.resources.length > 0 && (
          <div className="tag-card__relations__category">
            <h5>Resources</h5>
            <div className="tag-card__relations__items">
              {tag.resources.map((resource) => {
                const config = resource.tagsDetailed?.find((t) => t.id === tag.id)?.config;
                return (
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
                    {config && (
                      <div className="tag-card__relation-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tag.middlewares.length > 0 && (
          <div className="tag-card__relations__category">
            <h5>Middlewares</h5>
            <div className="tag-card__relations__items">
              {tag.middlewares.map((middleware) => {
                const config = middleware.tagsDetailed?.find((t) => t.id === tag.id)?.config;
                return (
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
                    {config && (
                      <div className="tag-card__relation-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tag.events.length > 0 && (
          <div className="tag-card__relations__category">
            <h5>Events</h5>
            <div className="tag-card__relations__items">
              {tag.events.map((event) => {
                const config = event.tagsDetailed?.find((t) => t.id === tag.id)?.config;
                return (
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
                    {config && (
                      <div className="tag-card__relation-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tag.hooks.length > 0 && (
          <div className="tag-card__relations__category">
            <h5>Hooks</h5>
            <div className="tag-card__relations__items">
              {tag.hooks.map((hook) => {
                const config = hook.tagsDetailed?.find((t) => t.id === tag.id)?.config;
                return (
                  <div
                    key={hook.id}
                    className="tag-card__relation-item tag-card__relation-item--hook"
                  >
                    <a
                      href={`#element-${hook.id}`}
                      className="tag-card__relation-link"
                    >
                      <div className="title title--hook">
                        {hook.meta?.title || formatId(hook.id)}
                      </div>
                      <div className="id">{hook.id}</div>
                    </a>
                    {config && (
                      <div className="tag-card__relation-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
