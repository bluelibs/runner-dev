import React from "react";

type ToolCall = {
  id: string;
  name?: string;
  argsPreview?: string;
  status: "pending" | "running" | "done" | "error";
  resultPreview?: string;
};

export const TypingIndicator: React.FC<{
  stage?: "thinking" | "processing" | "generating";
  toolCalls?: ToolCall[];
}> = ({ stage = "thinking", toolCalls = [] }) => {
  const count = (toolCalls || []).length;
  const base =
    stage === "processing"
      ? "Calling tools"
      : stage === "generating"
      ? "Generating response"
      : "Thinking";
  const stageLabel = count > 0 ? `${base} (${count} tools)` : `${base}...`;
  const visibleCalls = (toolCalls || []).filter((t): t is ToolCall =>
    Boolean(t)
  );
  return (
    <div className="chat-message chat-message--bot" aria-live="polite">
      <div className="chat-message-header">
        <span className="chat-message-author">AI</span>
        <span className="chat-message-time">Now</span>
      </div>
      <div className="chat-bubble">
        <div className="thinking-animation">
          <div className="thinking-stage">{stageLabel}</div>
          <div className="thinking-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
        {visibleCalls.length > 0 && (
          <div className="tool-calls-list" style={{ marginTop: 8 }}>
            {visibleCalls.map((t, i) => (
              <div
                key={t.id || i}
                className={`tool-call tool-call--${t.status}`}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.08)",
                  marginBottom: 6,
                  background:
                    t.status === "done"
                      ? "#f4fdf7"
                      : t.status === "error"
                      ? "#fff5f5"
                      : "#f8f9fb",
                  color: "#111",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="tool-call-status"
                    style={{ fontSize: 12, opacity: 0.8 }}
                  >
                    {t.status === "pending"
                      ? "pending"
                      : t.status === "running"
                      ? "running"
                      : t.status === "done"
                      ? "done"
                      : "error"}
                  </span>
                  <code style={{ fontSize: 12, color: "#111" }}>
                    {t.name || "tool"}
                    {t.argsPreview ? `(${t.argsPreview})` : "()"}
                  </code>
                </div>
                {t.resultPreview && (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "transparent",
                      margin: "6px 0 0 0",
                      fontSize: 12,
                      color: "#111",
                    }}
                  >
                    {t.resultPreview}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
