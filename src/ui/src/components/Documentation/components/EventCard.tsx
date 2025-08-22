import React from "react";
import { Event } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";

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

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e9ecef",
    borderRadius: "12px",
    overflow: "hidden" as const,
    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
    marginBottom: "20px",
  };

  const headerStyle = {
    background: "linear-gradient(135deg, #ffc107, #ff8f00)",
    color: "white",
    padding: "25px",
  };

  const contentStyle = {
    padding: "25px",
  };

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
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "24px",
                fontWeight: "700",
              }}
            >
              {getEventIcon()} {event.meta?.title || formatId(event.id)}
            </h3>
            <div
              style={{
                fontSize: "14px",
                opacity: 0.9,
                fontFamily: "monospace",
                marginBottom: "15px",
              }}
            >
              {event.id}
            </div>
            {event.meta?.description && (
              <p
                style={{
                  margin: "0",
                  fontSize: "16px",
                  opacity: 0.95,
                  lineHeight: "1.5",
                }}
              >
                {event.meta.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(255,255,255,0.2)",
                  padding: "4px 8px",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontSize: "12px" }}>📤</span>
                <span style={{ fontSize: "12px", fontWeight: "500" }}>
                  {emitters.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(255,255,255,0.2)",
                  padding: "4px 8px",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontSize: "12px" }}>📥</span>
                <span style={{ fontSize: "12px", fontWeight: "500" }}>
                  {hooks.length}
                </span>
              </div>
            </div>
            {event.meta?.tags && event.meta.tags.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {event.meta.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      padding: "4px 12px",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={contentStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "25px",
          }}
        >
          <div>
            <h4
              style={{
                margin: "0 0 15px 0",
                color: "#2c3e50",
                fontSize: "18px",
                borderBottom: "2px solid #e9ecef",
                paddingBottom: "8px",
              }}
            >
              📋 Overview
            </h4>
            <div style={{ display: "grid", gap: "15px" }}>
              <div>
                <strong style={{ color: "#495057" }}>File Path:</strong>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    color: "#6c757d",
                    marginTop: "4px",
                    background: "#f8f9fa",
                    padding: "8px",
                    borderRadius: "4px",
                  }}
                >
                  {formatFilePath(event.filePath)}
                </div>
              </div>

              {event.registeredBy && (
                <div>
                  <strong style={{ color: "#495057" }}>Registered By:</strong>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "13px",
                      color: "#6c757d",
                      marginTop: "4px",
                      background: "#f8f9fa",
                      padding: "8px",
                      borderRadius: "4px",
                    }}
                  >
                    {event.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: "#495057" }}>Event Status:</strong>
                <div
                  style={{
                    fontSize: "13px",
                    color: status.color,
                    marginTop: "4px",
                    background: "#f8f9fa",
                    padding: "8px",
                    borderRadius: "4px",
                    fontWeight: "500",
                  }}
                >
                  {status.text}
                </div>
              </div>

              <div>
                <strong style={{ color: "#495057" }}>Listened To By:</strong>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#6c757d",
                    marginTop: "4px",
                    background: "#f8f9fa",
                    padding: "8px",
                    borderRadius: "4px",
                  }}
                >
                  {formatArray(event.listenedToBy)}
                </div>
              </div>

              {(emitters.length === 0 || hooks.length === 0) && (
                <div
                  style={{
                    background: emitters.length === 0 ? "#f8d7da" : "#fff3cd",
                    border: `1px solid ${
                      emitters.length === 0 ? "#f5c6cb" : "#ffeaa7"
                    }`,
                    padding: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: emitters.length === 0 ? "#721c24" : "#856404",
                    }}
                  >
                    {emitters.length === 0
                      ? "⚠️ No Emitters Found"
                      : "⚠️ No Listeners Found"}
                  </strong>
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      color: emitters.length === 0 ? "#721c24" : "#856404",
                    }}
                  >
                    {emitters.length === 0
                      ? "This event is not emitted by any tasks, hooks, or resources."
                      : "This event has no hooks listening to it."}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4
              style={{
                margin: "0 0 15px 0",
                color: "#2c3e50",
                fontSize: "18px",
                borderBottom: "2px solid #e9ecef",
                paddingBottom: "8px",
              }}
            >
              📝 Payload Schema
            </h4>
            <pre
              style={{
                background: "#f8f9fa",
                padding: "20px",
                borderRadius: "8px",
                fontSize: "12px",
                lineHeight: "1.6",
                overflow: "auto",
                border: "1px solid #e9ecef",
                margin: 0,
              }}
            >
              {formatSchema(event.payloadSchema)}
            </pre>
          </div>
        </div>

        <div style={{ marginTop: "30px" }}>
          <h4
            style={{
              margin: "0 0 20px 0",
              color: "#2c3e50",
              fontSize: "18px",
              borderBottom: "2px solid #e9ecef",
              paddingBottom: "8px",
            }}
          >
            🔗 Event Flow & Statistics
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
              marginBottom: "25px",
            }}
          >
            <div
              style={{
                background: emitters.length > 0 ? "#d4edda" : "#f8d7da",
                padding: "20px",
                borderRadius: "8px",
                textAlign: "center",
                border: `2px solid ${
                  emitters.length > 0 ? "#c3e6cb" : "#f5c6cb"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: emitters.length > 0 ? "#155724" : "#721c24",
                }}
              >
                {emitters.length}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: emitters.length > 0 ? "#155724" : "#721c24",
                }}
              >
                Emitters
              </div>
            </div>
            <div
              style={{
                background: hooks.length > 0 ? "#d4edda" : "#fff3cd",
                padding: "20px",
                borderRadius: "8px",
                textAlign: "center",
                border: `2px solid ${hooks.length > 0 ? "#c3e6cb" : "#ffeaa7"}`,
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: hooks.length > 0 ? "#155724" : "#856404",
                }}
              >
                {hooks.length}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: hooks.length > 0 ? "#155724" : "#856404",
                }}
              >
                Listeners
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "25px",
            }}
          >
            {emitters.length > 0 && (
              <div>
                <h5
                  style={{
                    margin: "0 0 15px 0",
                    color: "#495057",
                    fontSize: "16px",
                  }}
                >
                  Event Emitters
                </h5>
                <div style={{ display: "grid", gap: "10px" }}>
                  {emitters.map((emitter) => {
                    let bgColor = "#f8f9fa";
                    let borderColor = "#dee2e6";
                    let icon = "📤";

                    // Determine the type of emitter
                    if ("emits" in emitter && Array.isArray(emitter.emits)) {
                      if ("dependsOn" in emitter && "middleware" in emitter) {
                        // It's a Task
                        bgColor = "#e3f2fd";
                        borderColor = "#2196f3";
                        icon = "⚙️";
                      } else if ("event" in emitter) {
                        // It's a Hook
                        bgColor = "#f3e5f5";
                        borderColor = "#9c27b0";
                        icon = "🪝";
                      }
                    } else if ("config" in emitter) {
                      // It's a Resource
                      bgColor = "#e8f5e8";
                      borderColor = "#4caf50";
                      icon = "🔧";
                    }

                    return (
                      <div
                        key={emitter.id}
                        style={{
                          padding: "12px 16px",
                          background: bgColor,
                          borderRadius: "8px",
                          borderLeft: `4px solid ${borderColor}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span>{icon}</span>
                          <div>
                            <div
                              style={{
                                fontWeight: "600",
                                color:
                                  borderColor === "#2196f3"
                                    ? "#1976d2"
                                    : borderColor === "#9c27b0"
                                    ? "#7b1fa2"
                                    : "#2e7d32",
                              }}
                            >
                              {emitter.meta?.title || formatId(emitter.id)}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                fontFamily: "monospace",
                              }}
                            >
                              {emitter.id}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hooks.length > 0 && (
              <div>
                <h5
                  style={{
                    margin: "0 0 15px 0",
                    color: "#495057",
                    fontSize: "16px",
                  }}
                >
                  Event Listeners
                </h5>
                <div style={{ display: "grid", gap: "10px" }}>
                  {hooks.map((hook) => (
                    <div
                      key={hook.id}
                      style={{
                        padding: "12px 16px",
                        background: "#f3e5f5",
                        borderRadius: "8px",
                        borderLeft: "4px solid #9c27b0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span>🪝</span>
                            <div>
                              <div
                                style={{ fontWeight: "600", color: "#7b1fa2" }}
                              >
                                {hook.meta?.title || formatId(hook.id)}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#666",
                                  fontFamily: "monospace",
                                }}
                              >
                                {hook.id}
                              </div>
                            </div>
                          </div>
                          {hook.meta?.description && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                marginTop: "4px",
                                fontStyle: "italic",
                              }}
                            >
                              {hook.meta.description}
                            </div>
                          )}
                        </div>
                        {hook.hookOrder !== null &&
                          hook.hookOrder !== undefined && (
                            <span
                              style={{
                                background: "#e1bee7",
                                color: "#4a148c",
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
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
            <div
              style={{
                color: "#6c757d",
                fontStyle: "italic",
                textAlign: "center",
                padding: "40px",
                background: "#f8f9fa",
                borderRadius: "8px",
              }}
            >
              This event has no emitters or listeners.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
