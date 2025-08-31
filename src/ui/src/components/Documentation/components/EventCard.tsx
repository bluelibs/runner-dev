import React from "react";
import { Event } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatSchema, formatFilePath, formatId } from "../utils/formatting";
import { TagsSection } from "./TagsSection";
import "./EventCard.scss";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_EVENT_FILE_QUERY,
} from "../utils/graphqlClient";
import SchemaRenderer from "./SchemaRenderer";
import ExecuteModal from "./ExecuteModal";

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
  const isGlobalEvent = event.id === "*";

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!event?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        event: { fileContents: string | null };
      }>(SAMPLE_EVENT_FILE_QUERY, { id: event.id });
      setFileContent(data?.event?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  const getEventIcon = () => {
    if (isGlobalEvent) return "🌐";
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
  const [isExecuteOpen, setIsExecuteOpen] = React.useState(false);

  return (
    <div id={`element-${event.id}`} className="event-card">
      <div className="event-card__header">
        <div className="event-card__header-content">
          <div className="main">
            <h3 className="event-card__title">
              {getEventIcon()}{" "}
              {isGlobalEvent
                ? event.meta?.title || "Global Event"
                : event.meta?.title || formatId(event.id)}
              {isGlobalEvent && (
                <span className="event-card__global-badge">GLOBAL</span>
              )}
            </h3>
            {!isGlobalEvent && <div className="event-card__id">{event.id}</div>}
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
                <span className="count">Emitters: {emitters.length}</span>
              </div>
              <div className="event-card__stat-badge">
                <span className="icon">📥</span>
                <span className="count">Hooks: {hooks.length}</span>
              </div>
              <div className="event-card__run">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsExecuteOpen(true)}
                  title="Invoke Event"
                >
                  🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="event-card__content">
        <div className="event-card__grid">
          <div>
            <div className="event-card__section">
              <h4 className="event-card__section__title">📋 Overview</h4>
              <div className="event-card__section__content">
                {isGlobalEvent && (
                  <div className="event-card__global-message">
                    <div className="event-card__global-message__header">
                      <span className="icon">🌐</span>
                      <h5 className="title">Global/System Event</h5>
                    </div>
                    <div className="event-card__global-message__content">
                      This event is part of the global/system namespace and can
                      be used across the entire application lifecycle.
                    </div>
                  </div>
                )}
                <div className="event-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {event.filePath ? (
                      <a
                        type="button"
                        onClick={openFileModal}
                        title="View file contents"
                      >
                        {formatFilePath(event.filePath)}
                      </a>
                    ) : (
                      formatFilePath(event.filePath)
                    )}
                  </div>
                </div>

                {event.registeredBy && (
                  <div className="event-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${event.registeredBy}`}
                        className="event-card__registrar-link"
                      >
                        {event.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                <div className="event-card__info-block">
                  <div className="label">Event Status:</div>
                  <div
                    className="value value--status"
                    style={{ color: status.color }}
                  >
                    {status.text}
                  </div>
                </div>

                {event.listenedToBy && event.listenedToBy.length > 0 && (
                  <div className="event-card__info-block">
                    <div className="label">Listened To By:</div>
                    <div className="event-card__listeners-list">
                      {event.listenedToBy.map((id) => (
                        <a
                          key={id}
                          href={`#element-${id}`}
                          className="event-card__listener-item"
                        >
                          <div className="event-card__listener-item__content">
                            <div className="title">{formatId(id)}</div>
                            <div className="id">{id}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {event.tags && event.tags.length > 0 && (
                  <div className="event-card__info-block">
                    <div className="label">Tags:</div>
                    <div className="value">
                      <div className="event-card__tags">
                        {introspector.getTagsByIds(event.tags).map((tag) => (
                          <a
                            href={`#element-${tag.id}`}
                            key={tag.id}
                            className="clean-button"
                          >
                            {formatId(tag.id)}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {((!isGlobalEvent && emitters.length === 0) ||
                  hooks.length === 0) && (
                  <div
                    className={`event-card__alert ${
                      emitters.length === 0
                        ? "event-card__alert--danger"
                        : "event-card__alert--warning"
                    }`}
                  >
                    <div className="title">
                      {!isGlobalEvent && emitters.length === 0
                        ? "⚠️ No Emitters Found"
                        : "⚠️ No Listeners Found"}
                    </div>
                    <div className="content">
                      {!isGlobalEvent && emitters.length === 0
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
              <div className="event-card__config">
                <SchemaRenderer schemaString={event.payloadSchema} />
              </div>
            </div>
          </div>
        </div>

        <div className="event-card__flow">
          <h4 className="event-card__flow__title">
            🔗 Event Flow & Statistics
          </h4>
          <div className="event-card__metrics">
            <div
              className={`event-card__metric ${
                emitters.length > 0
                  ? "event-card__metric--active"
                  : "event-card__metric--danger"
              }`}
            >
              <div className="value">{emitters.length}</div>
              <div className="label">Emitters</div>
            </div>
            <div
              className={`event-card__metric ${
                hooks.length > 0
                  ? "event-card__metric--active"
                  : "event-card__metric--warning"
              }`}
            >
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
                      <a
                        key={emitter.id}
                        href={`#element-${emitter.id}`}
                        className={`${className} event-card__emitter-link`}
                      >
                        <div className="event-card__emitter__content">
                          <span>{icon}</span>
                          <div className="event-card__emitter__info">
                            <div
                              className={`title ${
                                className.includes("--task")
                                  ? "title--task"
                                  : className.includes("--hook")
                                  ? "title--hook"
                                  : "title--resource"
                              }`}
                            >
                              {emitter.meta?.title || formatId(emitter.id)}
                            </div>
                            <div className="id">{emitter.id}</div>
                          </div>
                        </div>
                      </a>
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
                    <a
                      key={hook.id}
                      href={`#element-${hook.id}`}
                      className="event-card__listener event-card__listener-link"
                    >
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
                    </a>
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

        <TagsSection
          element={event}
          introspector={introspector}
          className="event-card__tags-section"
        />
      </div>

      <CodeModal
        title={
          isGlobalEvent
            ? event.meta?.title || "Global Event"
            : event.meta?.title || formatId(event.id)
        }
        subtitle={event.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(event.filePath)}
        saveOnFile={event.filePath || null}
      />

      <ExecuteModal
        isOpen={isExecuteOpen}
        title={event.meta?.title || formatId(event.id)}
        schemaString={event.payloadSchema}
        onClose={() => setIsExecuteOpen(false)}
        onInvoke={async ({ inputJson }) => {
          const INVOKE_EVENT_MUTATION = `
            mutation InvokeEvent($eventId: ID!, $inputJson: String, $evalInput: Boolean) {
              invokeEvent(eventId: $eventId, inputJson: $inputJson, evalInput: $evalInput) {
                success
                error
                invocationId
              }
            }
          `;

          try {
            const res = await graphqlRequest<{
              invokeEvent: {
                success: boolean;
                error?: string | null;
                invocationId?: string | null;
              };
            }>(INVOKE_EVENT_MUTATION, {
              eventId: event.id,
              inputJson: inputJson?.trim() || undefined,
              evalInput: false,
            });

            return {
              output: res.invokeEvent.success
                ? "Event invoked successfully"
                : res.invokeEvent.error ?? undefined,
              error: res.invokeEvent.error ?? undefined,
            };
          } catch (e: any) {
            return { error: e?.message ?? String(e) };
          }
        }}
      />
    </div>
  );
};
