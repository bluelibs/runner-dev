import React from "react";
import { Introspector } from "../../../resources/introspector.resource";

export interface TagCardProps {
  tag: any;
  introspector: Introspector;
}

export const TagCard: React.FC<TagCardProps> = ({ tag }) => {
  return (
    <div
      key={tag.id}
      style={{
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: "12px",
        padding: "25px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
        transition: "transform 0.2s ease",
        wordWrap: "break-word",
        overflow: "hidden",
      }}
    >
      <h3
        style={{
          margin: "0 0 20px 0",
          color: "#2c3e50",
          fontSize: "20px",
          borderBottom: "2px solid #e9ecef",
          paddingBottom: "10px",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        🏷️ {tag.id}
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "15px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: "10px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#007acc",
            }}
          >
            {tag.tasks.length}
          </div>
          <div style={{ fontSize: "12px", color: "#6c757d" }}>Tasks</div>
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "10px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#28a745",
            }}
          >
            {tag.resources.length}
          </div>
          <div style={{ fontSize: "12px", color: "#6c757d" }}>Resources</div>
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "10px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#ffc107",
            }}
          >
            {tag.events.length}
          </div>
          <div style={{ fontSize: "12px", color: "#6c757d" }}>Events</div>
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "10px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#6f42c1",
            }}
          >
            {tag.middlewares.length}
          </div>
          <div style={{ fontSize: "12px", color: "#6c757d" }}>Middlewares</div>
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "10px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#17a2b8",
            }}
          >
            {tag.hooks.length}
          </div>
          <div style={{ fontSize: "12px", color: "#6c757d" }}>Hooks</div>
        </div>
      </div>
    </div>
  );
};