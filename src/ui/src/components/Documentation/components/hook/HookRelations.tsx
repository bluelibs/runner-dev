import React from "react";
import { Event, Hook } from "../../../../../../schema/model";
import { formatId } from "../../utils/formatting";

export interface HookRelationsProps {
  dependencies: {
    tasks: Array<{ id: string; meta?: { title?: string | null } | null }>;
    resources: Array<{ id: string; meta?: { title?: string | null } | null }>;
  };
  emittedEvents: Event[];
}

export const HookRelations: React.FC<HookRelationsProps> = ({
  dependencies,
  emittedEvents,
}) => {
  if (
    dependencies.tasks.length === 0 &&
    dependencies.resources.length === 0 &&
    emittedEvents.length === 0
  )
    return null;

  return (
    <div className="hook-card__dependencies">
      <h4 className="hook-card__dependencies__title">
        🔗 Dependencies & Relations
      </h4>
      <div className="hook-card__dependencies__grid">
        {dependencies.tasks.length > 0 && (
          <div className="hook-card__dependencies__category">
            <h5>Task Dependencies</h5>
            <div className="hook-card__dependencies__items">
              {dependencies.tasks.map((dep) => (
                <a
                  key={dep.id}
                  href={`#element-${dep.id}`}
                  className="hook-card__dependency-item hook-card__dependency-item--task hook-card__dependency-link"
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
          <div className="hook-card__dependencies__category">
            <h5>Resource Dependencies</h5>
            <div className="hook-card__dependencies__items">
              {dependencies.resources.map((dep) => (
                <a
                  key={dep.id}
                  href={`#element-${dep.id}`}
                  className="hook-card__dependency-item hook-card__dependency-item--resource hook-card__dependency-link"
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
          <div className="hook-card__dependencies__category">
            <h5>Emitted Events</h5>
            <div className="hook-card__dependencies__items">
              {emittedEvents.map((event) => (
                <a
                  key={event.id}
                  href={`#element-${event.id}`}
                  className="hook-card__dependency-item hook-card__dependency-item--event hook-card__dependency-link"
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
  );
};
