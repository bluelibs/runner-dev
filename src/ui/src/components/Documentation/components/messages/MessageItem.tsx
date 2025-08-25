import React from "react";
import { ChatMessage, FileMessage, TextMessage } from "../ChatTypes";
import { parseMessageForFiles } from "../ChatUtils";
import { MarkdownRenderer } from "../../utils/markdownUtils";

type Props = {
  message: ChatMessage;
  onOpenFile: (file: FileMessage["file"], title: string) => void;
  onOpenDiff: (diff: any) => void;
};

export const MessageItem: React.FC<Props> = React.memo(
  ({ message, onOpenFile, onOpenDiff }) => {
    return (
      <div className={`chat-message chat-message--${message.author}`}>
        <div className="chat-message-header">
          <span className="chat-message-author">
            {message.author === "user" ? "You" : "AI"}
          </span>
          <span className="chat-message-time">
            {/* time handled by parent */}
          </span>
        </div>
        <div className="chat-bubble">
          {message.type === "text" && (
            <div className="message-text">
              {message.author === "bot" ? (
                <MarkdownRenderer content={(message as TextMessage).text} />
              ) : (
                parseMessageForFiles((message as TextMessage).text).map(
                  (part, idx) => (
                    <span key={idx}>
                      {part.type === "text" ? (
                        part.content
                      ) : (
                        <button
                          className="file-reference-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenFile(
                              {
                                fileName: part.content,
                                content: `// File: ${part.content}\n// This is a simulated file view\n// In production, this would load the actual file content`,
                                language: "typescript",
                              },
                              `File: ${part.content}`
                            );
                          }}
                        >
                          [{part.content}]
                        </button>
                      )}
                    </span>
                  )
                )
              )}
            </div>
          )}

          {message.author === "bot" &&
            message.type === "text" &&
            (() => {
              const tm = message as TextMessage;
              const calls = tm.toolCalls || [];
              if (!calls.length) return null;
              return (
                <details
                  className="message-tool-calls"
                  style={{ marginTop: 8 }}
                >
                  <summary style={{ cursor: "pointer", opacity: 0.85 }}>
                    Used tools ({calls.length})
                  </summary>
                  <div style={{ marginTop: 6 }}>
                    {calls.map((c, i) => (
                      <div key={c.id || i}>
                        <code style={{ fontSize: 12 }}>
                          {c.name || "tool"}
                          {c.argsPreview ? `(${c.argsPreview})` : "()"}
                        </code>
                        {c.resultPreview && (
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: "transparent",
                              margin: "6px 0 0 0",
                              fontSize: 12,
                            }}
                          >
                            {c.resultPreview}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })()}

          {message.type === "file" && (
            <div className="message-file">
              {message.text && (
                <div className="message-text">{message.text}</div>
              )}
              <div
                className="file-preview"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFile(message.file, `File: ${message.file.fileName}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenFile(message.file, `File: ${message.file.fileName}`);
                  }
                }}
              >
                <div className="file-header">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{message.file.fileName}</span>
                </div>
                <div className="file-snippet">
                  {message.file.content.split("\n").slice(0, 3).join("\n")}
                  {message.file.content.split("\n").length > 3 && "\n..."}
                </div>
              </div>
            </div>
          )}

          {message.type === "diff" && (
            <div className="message-diff">
              {message.text && (
                <div className="message-text">{message.text}</div>
              )}
              <div
                className="diff-preview"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDiff(message.diff);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenDiff(message.diff);
                  }
                }}
              >
                <div className="diff-header">
                  <span className="diff-icon">🔄</span>
                  <span className="diff-file">{message.diff.fileName}</span>
                </div>
                <div className="diff-stats">
                  <span className="diff-additions">
                    +{message.diff.newVersion.split("\n").length}
                  </span>
                  <span className="diff-deletions">
                    -{message.diff.previousVersion.split("\n").length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);
