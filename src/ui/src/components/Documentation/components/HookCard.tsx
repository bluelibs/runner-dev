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

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e9ecef",
    borderRadius: "12px",
    overflow: "hidden" as const,
    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
    marginBottom: "20px",
  };

  const headerStyle = {
    background: "linear-gradient(135deg, #9c27b0, #673ab7)",
    color: "white",
    padding: "25px",
  };

  const contentStyle = {
    padding: "25px",
  };

  const getHookOrderDisplay = () => {
    if (hook.hookOrder === null || hook.hookOrder === undefined)
      return "Default";
    return hook.hookOrder.toString();
  };

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
              🪝 {hook.meta?.title || formatId(hook.id)}
            </h3>
            <div
              style={{
                fontSize: "14px",
                opacity: 0.9,
                fontFamily: "monospace",
                marginBottom: "15px",
              }}
            >
              {hook.id}
            </div>
            {hook.meta?.description && (
              <p
                style={{
                  margin: "0",
                  fontSize: "16px",
                  opacity: 0.95,
                  lineHeight: "1.5",
                }}
              >
                {hook.meta.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {hook.hookOrder !== null && hook.hookOrder !== undefined && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    padding: "4px 8px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  #{hook.hookOrder}
                </div>
              )}
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
                  {emittedEvents.length}
                </span>
              </div>
            </div>
            {hook.meta?.tags && hook.meta.tags.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {hook.meta.tags.map((tag) => (
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
                  {formatFilePath(hook.filePath)}
                </div>
              </div>

              {hook.registeredBy && (
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
                    {hook.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: "#495057" }}>Target Event:</strong>
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
                  {formatId(hook.event)}
                  {targetEvent && targetEvent.meta?.title && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#6c757d",
                        marginTop: "4px",
                        fontStyle: "italic",
                      }}
                    >
                      ({targetEvent.meta.title})
                    </div>
                  )}
                </div>
              </div>

              <div>
                <strong style={{ color: "#495057" }}>Execution Order:</strong>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#9c27b0",
                    marginTop: "4px",
                    background: "#f8f9fa",
                    padding: "8px",
                    borderRadius: "4px",
                    fontWeight: "500",
                  }}
                >
                  {getHookOrderDisplay()}
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6c757d",
                      marginTop: "2px",
                      fontWeight: "normal",
                    }}
                  >
                    {hook.hookOrder === null || hook.hookOrder === undefined
                      ? "Uses default ordering"
                      : `Priority level ${hook.hookOrder}`}
                  </div>
                </div>
              </div>

              <div>
                <strong style={{ color: "#495057" }}>Emits Events:</strong>
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
                  {formatArray(hook.emits)}
                </div>
              </div>

              {!targetEvent && (
                <div
                  style={{
                    background: "#f8d7da",
                    border: "1px solid #f5c6cb",
                    padding: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <strong style={{ color: "#721c24" }}>
                    ❌ Invalid Target Event
                  </strong>
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "13px",
                      color: "#721c24",
                    }}
                  >
                    The event "{hook.event}" that this hook is listening to does
                    not exist or is not registered.
                  </div>
                </div>
              )}

              {hook.overriddenBy && (
                <div
                  style={{
                    background: "#fff3cd",
                    border: "1px solid #ffeaa7",
                    padding: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <strong style={{ color: "#856404" }}>
                    ⚠️ Overridden By:
                  </strong>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#856404",
                      marginTop: "8px",
                      fontFamily: "monospace",
                    }}
                  >
                    {hook.overriddenBy}
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
              📡 Target Event Details
            </h4>
            {targetEvent ? (
              <div>
                <div
                  style={{
                    background: "#f3e5f5",
                    border: "1px solid #e1bee7",
                    borderRadius: "8px",
                    padding: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>📡</span>
                    <h5
                      style={{ margin: 0, color: "#4a148c", fontSize: "16px" }}
                    >
                      {targetEvent.meta?.title || formatId(targetEvent.id)}
                    </h5>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "13px",
                      color: "#6a1b9a",
                      marginBottom: "10px",
                    }}
                  >
                    {targetEvent.id}
                  </div>
                  {targetEvent.meta?.description && (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#6a1b9a",
                        lineHeight: "1.4",
                      }}
                    >
                      {targetEvent.meta.description}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: "15px" }}>
                  <div
                    style={{
                      background: "#f8f9fa",
                      padding: "15px",
                      borderRadius: "8px",
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: "#495057",
                      }}
                    >
                      Payload Schema
                    </div>
                    <pre
                      style={{
                        background: "#fff",
                        padding: "12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        margin: 0,
                        border: "1px solid #dee2e6",
                        overflow: "auto",
                        lineHeight: "1.4",
                      }}
                    >
                      {formatSchema(targetEvent.payloadSchema)}
                    </pre>
                  </div>

                  <div
                    style={{
                      background: "#f8f9fa",
                      padding: "15px",
                      borderRadius: "8px",
                      border: "1px solid #e9ecef",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        marginBottom: "10px",
                        color: "#495057",
                      }}
                    >
                      Event Statistics
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "15px",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "20px",
                            fontWeight: "bold",
                            color: "#007acc",
                          }}
                        >
                          {
                            introspector.getEmittersOfEvent(targetEvent.id)
                              .length
                          }
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#6c757d",
                            fontWeight: "500",
                          }}
                        >
                          Emitters
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "20px",
                            fontWeight: "bold",
                            color: "#9c27b0",
                          }}
                        >
                          {introspector.getHooksOfEvent(targetEvent.id).length}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#6c757d",
                            fontWeight: "500",
                          }}
                        >
                          Hooks
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#f8d7da",
                  border: "1px solid #f5c6cb",
                  padding: "30px",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "48px" }}>❌</span>
                <h5 style={{ color: "#721c24", margin: "15px 0 10px 0" }}>
                  Event Not Found
                </h5>
                <p style={{ color: "#721c24", margin: 0 }}>
                  The target event "{hook.event}" does not exist in the current
                  application.
                </p>
              </div>
            )}
          </div>
        </div>

        {(dependencies.tasks.length > 0 ||
          dependencies.resources.length > 0 ||
          emittedEvents.length > 0) && (
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
              🔗 Dependencies & Relations
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "25px",
              }}
            >
              {dependencies.tasks.length > 0 && (
                <div>
                  <h5
                    style={{
                      margin: "0 0 15px 0",
                      color: "#495057",
                      fontSize: "16px",
                    }}
                  >
                    Task Dependencies
                  </h5>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {dependencies.tasks.map((dep) => (
                      <div
                        key={dep.id}
                        style={{
                          padding: "12px 16px",
                          background: "#e3f2fd",
                          borderRadius: "8px",
                          borderLeft: "4px solid #2196f3",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#1976d2" }}>
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontFamily: "monospace",
                          }}
                        >
                          {dep.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div>
                  <h5
                    style={{
                      margin: "0 0 15px 0",
                      color: "#495057",
                      fontSize: "16px",
                    }}
                  >
                    Resource Dependencies
                  </h5>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {dependencies.resources.map((dep) => (
                      <div
                        key={dep.id}
                        style={{
                          padding: "12px 16px",
                          background: "#e8f5e8",
                          borderRadius: "8px",
                          borderLeft: "4px solid #4caf50",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#2e7d32" }}>
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontFamily: "monospace",
                          }}
                        >
                          {dep.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div>
                  <h5
                    style={{
                      margin: "0 0 15px 0",
                      color: "#495057",
                      fontSize: "16px",
                    }}
                  >
                    Emitted Events
                  </h5>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {emittedEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: "12px 16px",
                          background: "#fff3e0",
                          borderRadius: "8px",
                          borderLeft: "4px solid #ff9800",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#f57c00" }}>
                          {event.meta?.title || formatId(event.id)}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontFamily: "monospace",
                          }}
                        >
                          {event.id}
                        </div>
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
