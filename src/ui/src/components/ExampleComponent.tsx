import React from "react";
import { Documentation } from "./Documentation";
import { Introspector } from "../../../resources/models/Introspector";

export interface ExampleComponentProps {
  title?: string;
  message?: string;
  items?: string[];
  introspector?: Introspector;
  showDocumentation?: boolean;
}

export const ExampleComponent: React.FC<ExampleComponentProps> = ({
  title = "Runner Dev React Component",
  message = "This is a server-side rendered React component!",
  items = ["Feature 1", "Feature 2", "Feature 3"],
  introspector,
  showDocumentation = false,
}) => {
  if (showDocumentation && introspector) {
    return <Documentation introspector={introspector} />;
  }

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ color: "#333", borderBottom: "2px solid #007acc" }}>
        {title}
      </h1>
      <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
        {message}
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((item, index) => (
          <li
            key={index}
            style={{
              background: "#f5f5f5",
              margin: "10px 0",
              padding: "10px",
              borderLeft: "4px solid #007acc",
              borderRadius: "4px",
            }}
          >
            {item}
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          background: "#e8f4fd",
          borderRadius: "4px",
        }}
      >
        <strong>Server-side rendered at:</strong> {new Date().toISOString()}
      </div>

      {introspector && (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
          }}
        >
          <h2 style={{ margin: "0 0 15px 0", color: "#495057" }}>
            📚 Documentation Available
          </h2>
          <p style={{ color: "#6c757d", margin: "0 0 15px 0" }}>
            Interactive documentation is available for this Runner application.
            View detailed information about tasks, resources, events, and more.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "10px",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: "10px",
                background: "#fff",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#007acc",
                }}
              >
                {introspector.getTasks().length}
              </div>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>Tasks</div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "10px",
                background: "#fff",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#28a745",
                }}
              >
                {introspector.getResources().length}
              </div>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>
                Resources
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "10px",
                background: "#fff",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#ffc107",
                }}
              >
                {introspector.getEvents().length}
              </div>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>Events</div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "10px",
                background: "#fff",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#6f42c1",
                }}
              >
                {introspector.getMiddlewares().length}
              </div>
              <div style={{ fontSize: "12px", color: "#6c757d" }}>
                Middlewares
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <a
              href="?docs=true"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "#007acc",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "500",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#0056b3";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#007acc";
              }}
            >
              📖 View Documentation
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
