import React from "react";
import { Hook } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import './HookCard.scss';

export interface HookCardProps {
  hook: Hook;
  introspector: Introspector;
}

export const HookCard: React.FC<HookCardProps> = ({ hook, introspector }) => {
  const dependencies = introspector.getDependencies(hook);
  const emittedEvents = introspector.getEmittedEvents(hook);
  const targetEvent = introspector.getEvent(hook.event);


  const getHookOrderDisplay = () => {
    if (hook.hookOrder === null || hook.hookOrder === undefined)
      return "Default";
    return hook.hookOrder.toString();
  };

  return (
    <div className="hook-card">
      <div className="hook-card__header">
        <div className="hook-card__header-content">
          <div className="main">
            <h3 className="hook-card__title">
              🪝 {hook.meta?.title || formatId(hook.id)}
            </h3>
            <div className="hook-card__id">
              {hook.id}
            </div>
            {hook.meta?.description && (
              <p className="hook-card__description">
                {hook.meta.description}
              </p>
            )}
          </div>
          <div className="hook-card__stats">
            {hook.hookOrder !== null && hook.hookOrder !== undefined && (
              <div className="hook-card__order-badge">
                #{hook.hookOrder}
              </div>
            )}
            <div className="hook-card__stat-badge">
              <span className="icon">📤</span>
              <span className="count">{emittedEvents.length}</span>
            </div>
            {hook.meta?.tags && hook.meta.tags.length > 0 && (
              <div className="hook-card__tags">
                {hook.meta.tags.map((tag) => (
                  <span key={tag} className="hook-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hook-card__content">
        <div className="hook-card__grid">
          <div>
            <div className="hook-card__section">
              <h4 className="hook-card__section__title">📋 Overview</h4>
              <div className="hook-card__section__content">
                <div className="hook-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">{formatFilePath(hook.filePath)}</div>
                </div>

                {hook.registeredBy && (
                  <div className="hook-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">{hook.registeredBy}</div>
                  </div>
                )}

                <div className="hook-card__info-block">
                  <div className="label">Target Event:</div>
                  <div className="value">
                    {formatId(hook.event)}
                    {targetEvent && targetEvent.meta?.title && (
                      <div style={{
                        fontSize: "11px",
                        color: "#6c757d",
                        marginTop: "4px",
                        fontStyle: "italic",
                      }}>
                        ({targetEvent.meta.title})
                      </div>
                    )}
                  </div>
                </div>

                <div className="hook-card__info-block">
                  <div className="label">Execution Order:</div>
                  <div className="value value--order">
                    {getHookOrderDisplay()}
                    <div className="order-description">
                      {hook.hookOrder === null || hook.hookOrder === undefined
                        ? "Uses default ordering"
                        : `Priority level ${hook.hookOrder}`}
                    </div>
                  </div>
                </div>

                <div className="hook-card__info-block">
                  <div className="label">Emits Events:</div>
                  <div className="value">{formatArray(hook.emits)}</div>
                </div>

                {!targetEvent && (
                  <div className="hook-card__alert hook-card__alert--danger">
                    <div className="title">❌ Invalid Target Event</div>
                    <div className="content">
                      The event "{hook.event}" that this hook is listening to does
                      not exist or is not registered.
                    </div>
                  </div>
                )}

                {hook.overriddenBy && (
                  <div className="hook-card__alert hook-card__alert--warning">
                    <div className="title">⚠️ Overridden By:</div>
                    <div className="content">{hook.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="hook-card__section">
              <h4 className="hook-card__section__title">📡 Target Event Details</h4>
              {targetEvent ? (
                <div>
                  <div className="hook-card__target-event">
                    <div className="hook-card__target-event__header">
                      <span className="icon">📡</span>
                      <h5 className="title">
                        {targetEvent.meta?.title || formatId(targetEvent.id)}
                      </h5>
                    </div>
                    <div className="hook-card__target-event__id">
                      {targetEvent.id}
                    </div>
                    {targetEvent.meta?.description && (
                      <div className="hook-card__target-event__description">
                        {targetEvent.meta.description}
                      </div>
                    )}
                  </div>

                  <div className="hook-card__section__content">
                    <div className="hook-card__schema-block">
                      <div className="title">Payload Schema</div>
                      <pre className="schema">
                        {formatSchema(targetEvent.payloadSchema)}
                      </pre>
                    </div>

                    <div className="hook-card__schema-block">
                      <div className="title">Event Statistics</div>
                      <div className="hook-card__event-stats">
                        <div className="hook-card__event-stats__stat">
                          <div className="value value--emitters">
                            {introspector.getEmittersOfEvent(targetEvent.id).length}
                          </div>
                          <div className="label">Emitters</div>
                        </div>
                        <div className="hook-card__event-stats__stat">
                          <div className="value value--hooks">
                            {introspector.getHooksOfEvent(targetEvent.id).length}
                          </div>
                          <div className="label">Hooks</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hook-card__not-found">
                  <div className="icon">❌</div>
                  <h5 className="title">Event Not Found</h5>
                  <p className="message">
                    The target event "{hook.event}" does not exist in the current
                    application.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {(dependencies.tasks.length > 0 ||
          dependencies.resources.length > 0 ||
          emittedEvents.length > 0) && (
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
                      <div key={dep.id} className="hook-card__dependency-item hook-card__dependency-item--task">
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
                <div className="hook-card__dependencies__category">
                  <h5>Resource Dependencies</h5>
                  <div className="hook-card__dependencies__items">
                    {dependencies.resources.map((dep) => (
                      <div key={dep.id} className="hook-card__dependency-item hook-card__dependency-item--resource">
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
                <div className="hook-card__dependencies__category">
                  <h5>Emitted Events</h5>
                  <div className="hook-card__dependencies__items">
                    {emittedEvents.map((event) => (
                      <div key={event.id} className="hook-card__dependency-item hook-card__dependency-item--event">
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
      </div>
    </div>
  );
};
