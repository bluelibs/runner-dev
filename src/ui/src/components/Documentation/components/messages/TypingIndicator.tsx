import React, { useState } from "react";
import "./TypingIndicator.scss";
import { CodeModal } from "../CodeModal";
import { ToolCallsList } from "./ToolCallsList";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalContent, setModalContent] = useState<string | null>(null);

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

  function openModal(title: string, content: string | null) {
    setModalTitle(title);
    setModalContent(content ?? "");
    setModalOpen(true);
  }

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
          <ToolCallsList
            calls={visibleCalls}
            showStatus={true}
            onOpenArguments={(title, content) => openModal(title, content)}
            onOpenResponse={(title, content) => openModal(title, content)}
          />
        )}
      </div>

      <CodeModal
        title={modalTitle}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        code={modalContent ?? ""}
        enableEdit={false}
      />
    </div>
  );
};
