import React from "react";
import { Middleware } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";

export interface MiddlewareCardProps {
  middleware: Middleware;
  introspector: Introspector;
}

export const MiddlewareCard: React.FC<MiddlewareCardProps> = ({
  middleware,
  introspector,
}) => {
  const taskUsages = introspector.getTasksUsingMiddlewareDetailed(
    middleware.id
  );
  const resourceUsages = introspector.getResourcesUsingMiddlewareDetailed(
    middleware.id
  );
  const emittedEvents = introspector.getMiddlewareEmittedEvents(middleware.id);

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e9ecef",
    borderRadius: "12px",
    overflow: "hidden" as const,
    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
    marginBottom: "20px",
  };

  const headerStyle = {
    background: "linear-gradient(135deg, #6f42c1, #5a2b99)",
    color: "white",
    padding: "25px",
  };

  const contentStyle = {
    padding: "25px",
  };

  const getMiddlewareTypeIcon = () => {
    if (middleware.global?.enabled) return "🌐";
    if (
      middleware.usedByTasks.length > 0 &&
      middleware.usedByResources.length > 0
    )
      return "🔗";
    if (middleware.usedByTasks.length > 0) return "⚙️";
    if (middleware.usedByResources.length > 0) return "🔧";
    return "🔗";
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
              {getMiddlewareTypeIcon()}{" "}
              {middleware.meta?.title || formatId(middleware.id)}
            </h3>
            <div
              style={{
                fontSize: "14px",
                opacity: 0.9,
                fontFamily: "monospace",
                marginBottom: "15px",
              }}
            >
              {middleware.id}
            </div>
            {middleware.meta?.description && (
              <p
                style={{
                  margin: "0",
                  fontSize: "16px",
                  opacity: 0.95,
                  lineHeight: "1.5",
                }}
              >
                {middleware.meta.description}
              </p>
            )}

            {middleware.global?.enabled && (
              <div
                style={{
                  marginTop: "15px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    padding: "4px 12px",
                    borderRadius: "16px",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  🌐 Global
                </span>
                {middleware.global.tasks && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.25)",
                      padding: "4px 12px",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    Tasks
                  </span>
                )}
                {middleware.global.resources && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.25)",
                      padding: "4px 12px",
                      borderRadius: "16px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    Resources
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {middleware.meta?.tags && middleware.meta.tags.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {middleware.meta.tags.map((tag) => (
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
                  {formatFilePath(middleware.filePath)}
                </div>
              </div>

              {middleware.registeredBy && (
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
                    {middleware.registeredBy}
                  </div>
                </div>
              )}

              <div>
                <strong style={{ color: "#495057" }}>Usage Statistics:</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                    gap: "15px",
                    marginTop: "10px",
                  }}
                >
                  <div
                    style={{
                      background: "#e3f2fd",
                      padding: "15px",
                      borderRadius: "8px",
                      textAlign: "center",
                      border: "2px solid #2196f3",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#1976d2",
                      }}
                    >
                      {taskUsages.length}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#1976d2",
                        fontWeight: "500",
                      }}
                    >
                      Tasks
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#e8f5e8",
                      padding: "15px",
                      borderRadius: "8px",
                      textAlign: "center",
                      border: "2px solid #4caf50",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#2e7d32",
                      }}
                    >
                      {resourceUsages.length}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#2e7d32",
                        fontWeight: "500",
                      }}
                    >
                      Resources
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#fff3e0",
                      padding: "15px",
                      borderRadius: "8px",
                      textAlign: "center",
                      border: "2px solid #ff9800",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#f57c00",
                      }}
                    >
                      {emittedEvents.length}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#f57c00",
                        fontWeight: "500",
                      }}
                    >
                      Events
                    </div>
                  </div>
                </div>
              </div>

              {middleware.global?.enabled && (
                <div
                  style={{
                    background: "#e8f4fd",
                    border: "1px solid #bee5eb",
                    padding: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <strong style={{ color: "#0c5460" }}>
                    🌐 Global Middleware Configuration
                  </strong>
                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "13px",
                      color: "#0c5460",
                    }}
                  >
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Tasks:</strong>{" "}
                      {middleware.global.tasks ? "Enabled" : "Disabled"}
                    </div>
                    <div>
                      <strong>Resources:</strong>{" "}
                      {middleware.global.resources ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
              )}

              {middleware.overriddenBy && (
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
                    {middleware.overriddenBy}
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
              📝 Configuration Schema
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
              {formatSchema(middleware.configSchema)}
            </pre>
          </div>
        </div>

        {(taskUsages.length > 0 || resourceUsages.length > 0) && (
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
              🔗 Usage Details
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "25px",
              }}
            >
              {taskUsages.length > 0 && (
                <div>
                  <h5
                    style={{
                      margin: "0 0 15px 0",
                      color: "#495057",
                      fontSize: "16px",
                    }}
                  >
                    Used by Tasks
                  </h5>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {taskUsages.map((usage) => (
                      <div
                        key={usage.id}
                        style={{
                          background: "#f8f9fa",
                          border: "1px solid #e9ecef",
                          borderRadius: "8px",
                          padding: "20px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "15px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "600",
                                marginBottom: "5px",
                                color: "#2c3e50",
                                fontSize: "16px",
                              }}
                            >
                              {usage.node.meta?.title || formatId(usage.id)}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                fontFamily: "monospace",
                              }}
                            >
                              {usage.id}
                            </div>
                          </div>
                          {usage.config && (
                            <span
                              style={{
                                background: "#bbdefb",
                                color: "#1565c0",
                                padding: "4px 12px",
                                borderRadius: "16px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              Configured
                            </span>
                          )}
                        </div>
                        {usage.config && (
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#495057",
                                marginBottom: "8px",
                                fontWeight: "600",
                              }}
                            >
                              Configuration:
                            </div>
                            <pre
                              style={{
                                background: "#fff",
                                padding: "15px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                margin: 0,
                                border: "1px solid #dee2e6",
                                lineHeight: "1.4",
                              }}
                            >
                              {usage.config}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resourceUsages.length > 0 && (
                <div>
                  <h5
                    style={{
                      margin: "0 0 15px 0",
                      color: "#495057",
                      fontSize: "16px",
                    }}
                  >
                    Used by Resources
                  </h5>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {resourceUsages.map((usage) => (
                      <div
                        key={usage.id}
                        style={{
                          background: "#f8f9fa",
                          border: "1px solid #e9ecef",
                          borderRadius: "8px",
                          padding: "20px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "15px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "600",
                                marginBottom: "5px",
                                color: "#2c3e50",
                                fontSize: "16px",
                              }}
                            >
                              {usage.node.meta?.title || formatId(usage.id)}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                fontFamily: "monospace",
                              }}
                            >
                              {usage.id}
                            </div>
                          </div>
                          {usage.config && (
                            <span
                              style={{
                                background: "#c8e6c9",
                                color: "#2e7d32",
                                padding: "4px 12px",
                                borderRadius: "16px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              Configured
                            </span>
                          )}
                        </div>
                        {usage.config && (
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                color: "#495057",
                                marginBottom: "8px",
                                fontWeight: "600",
                              }}
                            >
                              Configuration:
                            </div>
                            <pre
                              style={{
                                background: "#fff",
                                padding: "15px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                margin: 0,
                                border: "1px solid #dee2e6",
                                lineHeight: "1.4",
                              }}
                            >
                              {usage.config}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {emittedEvents.length > 0 && (
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
              📡 Events Emitted by Usage
            </h4>
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

        {taskUsages.length === 0 && resourceUsages.length === 0 && (
          <div
            style={{
              marginTop: "30px",
              color: "#6c757d",
              fontStyle: "italic",
              textAlign: "center",
              padding: "40px",
              background: "#f8f9fa",
              borderRadius: "8px",
            }}
          >
            This middleware is not currently used by any tasks or resources.
          </div>
        )}
      </div>
    </div>
  );
};
