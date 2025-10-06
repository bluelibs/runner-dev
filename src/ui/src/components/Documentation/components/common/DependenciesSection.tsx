import React from "react";
import { Task, Resource, Hook, Event, Middleware, Error as ErrorModel } from "../../../../../../schema/model";
import { formatId } from "../../utils/formatting";

export interface DependenciesSectionProps {
  dependencies: {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
    errors: ErrorModel[];
  };
  emittedEvents?: Event[];
  className?: string;
  title?: string;
}

export const DependenciesSection: React.FC<DependenciesSectionProps> = ({
  dependencies,
  emittedEvents = [],
  className = "",
  title = "🔗 Dependencies & Relations",
}) => {
  if (
    dependencies.tasks.length === 0 &&
    dependencies.hooks.length === 0 &&
    dependencies.resources.length === 0 &&
    dependencies.errors.length === 0 &&
    emittedEvents.length === 0
  )
    return null;

  return (
    <div className={`dependencies-section ${className}`}>
      <h4 className="dependencies-section__title">{title}</h4>
      <div className="dependencies-section__grid">
        {dependencies.tasks.length > 0 && (
          <div className="dependencies-section__category">
            <h5>Task Dependencies</h5>
            <div className="dependencies-section__items">
              {dependencies.tasks.map((dep) => (
                <a
                  key={dep.id}
                  href={`#element-${dep.id}`}
                  className="dependencies-section__item dependencies-section__item--task dependencies-section__link"
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

        {dependencies.hooks.length > 0 && (
          <div className="dependencies-section__category">
            <h5>Hook Dependencies</h5>
            <div className="dependencies-section__items">
              {dependencies.hooks.map((dep) => (
                <a
                  key={dep.id}
                  href={`#element-${dep.id}`}
                  className="dependencies-section__item dependencies-section__item--hook dependencies-section__link"
                >
                  <div className="title title--hook">
                    {dep.meta?.title || formatId(dep.id)}
                  </div>
                  <div className="id">{dep.id}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {dependencies.resources.length > 0 && (
          <div className="dependencies-section__category">
            <h5>Resource Dependencies</h5>
            <div className="dependencies-section__items">
              {dependencies.resources.map((dep) => (
                <a
                  key={dep.id}
                  href={`#element-${dep.id}`}
                  className="dependencies-section__item dependencies-section__item--resource dependencies-section__link"
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

        {dependencies.errors.length > 0 && (
          <div className="dependencies-section__category">
            <h5>Error Dependencies</h5>
            <div className="dependencies-section__items">
              {dependencies.errors.map((error) => (
                <a
                  key={error.id}
                  href={`#element-${error.id}`}
                  className="dependencies-section__item dependencies-section__item--error dependencies-section__link"
                >
                  <div className="title title--error">
                    {error.meta?.title || formatId(error.id)}
                  </div>
                  <div className="id">{error.id}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {emittedEvents.length > 0 && (
          <div className="dependencies-section__category">
            <h5>Emitted Events</h5>
            <div className="dependencies-section__items">
              {emittedEvents.map((event) => (
                <a
                  key={event.id}
                  href={`#element-${event.id}`}
                  className="dependencies-section__item dependencies-section__item--event dependencies-section__link"
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