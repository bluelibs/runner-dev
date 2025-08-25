import React from "react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="chat-message chat-message--bot" aria-live="polite">
      <div className="chat-message-header">
        <span className="chat-message-author">AI</span>
        <span className="chat-message-time">Now</span>
      </div>
      <div className="chat-bubble">
        <div className="thinking-animation">
          <div className="thinking-stage">Thinking...</div>
          <div className="thinking-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
};
