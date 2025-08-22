import React from "react";
import { Event } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import "./EventCard.scss";

export interface EventCardProps {
  event: Event;
  introspector: Introspector;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  introspector,
}) => {
  const emitters = introspector.getEmittersOfEvent(event.id);
  const hooks = introspector.getHooksOfEvent(event.id);


  const getEventIcon = () => {
    if (hooks.length > 0 && emitters.length > 0) return "📡";
    if (emitters.length > 0) return "📤";
    if (hooks.length > 0) return "📥";
    return "📋";
  };

  const getEventStatus = () => {
    if (emitters.length === 0 && hooks.length === 0)
      return { text: "Unused", color: "#6c757d" };
    if (emitters.length === 0) return { text: "No Emitters", color: "#dc3545" };
    if (hooks.length === 0) return { text: "No Listeners", color: "#fd7e14" };
    return { text: "Active", color: "#28a745" };
  };

  const status = getEventStatus();

  return (
    <div className="event-card">
      <div className="event-card__header">
        <div className="event-card__header-content">
          <div className="main">
            <h3 className="event-card__title">
              {getEventIcon()} {event.meta?.title || formatId(event.id)}
            </h3>
            <div className="event-card__id">
              {event.id}
            </div>
            {event.meta?.description && (
              <p className="event-card__description">
                {event.meta.description}
              </p>
            )}
          </div>
          <div className="meta">
            <div className="event-card__stats">
              <div className="event-card__stat-badge">
                <span className="icon">📤</span>
                <span className="count">{emitters.length}</span>
              </div>
              <div className="event-card__stat-badge">
                <span className="icon">📥</span>
                <span className="count">{hooks.length}</span>
              </div>
            </div>
            {event.meta?.tags && event.meta.tags.length > 0 && (
              <div className="event-card__tags">
                {event.meta.tags.map((tag) => (
                  <span key={tag} className="event-card__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="event-card__content">
        <div className="event-card__grid">
          <div>
            <div className="event-card__section">
              <h4 className="event-card__section__title">📋 Overview</h4>
              <div className="event-card__section__content">
                <div className="event-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">{formatFilePath(event.filePath)}</div>
                </div>

                {event.registeredBy && (
                  <div className="event-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">{event.registeredBy}</div>
                  </div>
                )}

                <div className="event-card__info-block">
                  <div className="label">Event Status:</div>
                  <div className="value value--status" style={{ color: status.color }}>
                    {status.text}
                  </div>
                </div>

                <div className="event-card__info-block">
                  <div className="label">Listened To By:</div>
                  <div className="value">{formatArray(event.listenedToBy)}</div>
                </div>

                {(emitters.length === 0 || hooks.length === 0) && (
                  <div className={`event-card__alert ${
                    emitters.length === 0 ? 'event-card__alert--danger' : 'event-card__alert--warning'
                  }`}>
                    <div className="title">
                      {emitters.length === 0
                        ? "⚠️ No Emitters Found"
                        : "⚠️ No Listeners Found"}
                    </div>
                    <div className="content">
                      {emitters.length === 0
                        ? "This event is not emitted by any tasks, hooks, or resources."
                        : "This event has no hooks listening to it."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="event-card__section">
              <h4 className="event-card__section__title">📝 Payload Schema</h4>
              <pre className="event-card__code-block">
                {formatSchema(event.payloadSchema)}
              </pre>
            </div>
          </div>
        </div>

        <div className="event-card__flow">
          <h4 className="event-card__flow__title">🔗 Event Flow & Statistics</h4>
          <div className="event-card__metrics">
            <div className={`event-card__metric ${
              emitters.length > 0 ? 'event-card__metric--active' : 'event-card__metric--danger'
            }`}>
              <div className="value">{emitters.length}</div>
              <div className="label">Emitters</div>
            </div>
            <div className={`event-card__metric ${
              hooks.length > 0 ? 'event-card__metric--active' : 'event-card__metric--warning'
            }`}>
              <div className="value">{hooks.length}</div>
              <div className="label">Listeners</div>
            </div>
          </div>

          <div className="event-card__participants">
            {emitters.length > 0 && (
              <div className="event-card__participant-section">
                <h5>Event Emitters</h5>
                <div className="event-card__participant-section__items">
                  {emitters.map((emitter) => {
                    let className = "event-card__emitter";
                    let icon = "📤";

                    // Determine the type of emitter
                    if ("emits" in emitter && Array.isArray(emitter.emits)) {
                      if ("dependsOn" in emitter && "middleware" in emitter) {
                        // It's a Task
                        className += " event-card__emitter--task";
                        icon = "⚙️";
                      } else if ("event" in emitter) {
                        // It's a Hook
                        className += " event-card__emitter--hook";
                        icon = "🪝";
                      }
                    } else if ("config" in emitter) {
                      // It's a Resource
                      className += " event-card__emitter--resource";
                      icon = "🔧";
                    }

                    return (
                      <div key={emitter.id} className={className}>
                        <div className="event-card__emitter__content">
                          <span>{icon}</span>
                          <div className="event-card__emitter__info">
                            <div className={`title ${
                              className.includes('--task') ? 'title--task' :
                              className.includes('--hook') ? 'title--hook' : 'title--resource'
                            }`}>
                              {emitter.meta?.title || formatId(emitter.id)}
                            </div>
                            <div className="id">{emitter.id}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hooks.length > 0 && (
              <div className="event-card__participant-section">
                <h5>Event Listeners</h5>
                <div className="event-card__participant-section__items">
                  {hooks.map((hook) => (
                    <div key={hook.id} className="event-card__listener">
                      <div className="event-card__listener__content">
                        <div className="main">
                          <div className="event-card__listener__info">
                            <span>🪝</span>
                            <div className="details">
                              <div className="title">
                                {hook.meta?.title || formatId(hook.id)}
                              </div>
                              <div className="id">{hook.id}</div>
                            </div>
                          </div>
                          {hook.meta?.description && (
                            <div className="event-card__listener__description">
                              {hook.meta.description}
                            </div>
                          )}
                        </div>
                        {hook.hookOrder !== null &&
                          hook.hookOrder !== undefined && (
                            <span className="event-card__listener__order-badge">
                              Order: {hook.hookOrder}
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {emitters.length === 0 && hooks.length === 0 && (
            <div className="event-card__empty-state">
              This event has no emitters or listeners.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
