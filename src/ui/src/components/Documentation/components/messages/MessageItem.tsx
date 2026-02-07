import React from "react";
import { ChatMessage, FileMessage, TextMessage } from "../chat/ChatTypes";
import { parseMessageForFiles } from "../chat/ChatUtils";
import { MarkdownRenderer } from "../../utils/markdownUtils";
import { ToolCallsList } from "./ToolCallsList";
import { CodeModal } from "../CodeModal";

type Props = {
  message: ChatMessage;
  onOpenFile: (file: FileMessage["file"], title: string) => void;
  onOpenDiff: (diff: any) => void;
};

export const MessageItem: React.FC<Props> = React.memo(
  ({ message, onOpenFile, onOpenDiff }) => {
    const [copied, setCopied] = React.useState(false);
    const [modalOpen, setModalOpen] = React.useState(false);
    const [modalTitle, setModalTitle] = React.useState("");
    const [modalContent, setModalContent] = React.useState<string>("");

    const isBotText = message.author === "bot" && message.type === "text";
    const copyValue = isBotText ? (message as TextMessage).text : "";

    const handleCopy = React.useCallback(async (text: string) => {
      if (!text) return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.className = "clipboard-textarea";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // noop – keep it silent
      }
    }, []);
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
                <details className="message-tool-calls">
                  <summary>Used tools ({calls.length})</summary>
                  <div className="tool-calls-content">
                    <ToolCallsList
                      calls={calls}
                      showStatus={false}
                      onOpenArguments={(title, content) => {
                        setModalTitle(title);
                        setModalContent(content);
                        setModalOpen(true);
                      }}
                      onOpenResponse={(title, content) => {
                        setModalTitle(title);
                        setModalContent(content);
                        setModalOpen(true);
                      }}
                    />
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

          {isBotText && copyValue && (
            <button
              className={`chat-copy-btn${
                copied ? " chat-copy-btn--copied" : ""
              }`}
              aria-label={copied ? "Copied" : "Copy message"}
              title={copied ? "Copied!" : "Copy"}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(copyValue);
              }}
            />
          )}
        </div>
        <CodeModal
          title={modalTitle}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          code={modalContent}
          enableEdit={false}
        />
      </div>
    );
  }
);
