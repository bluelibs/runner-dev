import React, { useRef, useCallback, useState, useEffect } from "react";
import { ChatState } from "./ChatTypes";
// docs toggling handled at thread level via chatContext in useChatState

type ChatElement = {
  id: string;
  name: string;
  title?: string;
  description?: string;
};

export interface ChatInputProps {
  chatState: ChatState;
  setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
  sendMessage: () => void;
  sendMessageWithText: (
    messageText: string,
    displayText?: string,
    overrideInclude?: {
      runner?: boolean;
      runnerDev?: boolean;
      schema?: boolean;
      projectOverview?: boolean;
    }
  ) => void;
  stopRequest: () => void;
  onTaggedElementSelect?: (elementId: string, elementType: string) => void;
  // Available elements for tagging
  availableElements?: {
    tasks: Array<ChatElement>;
    resources: Array<ChatElement>;
    events: Array<ChatElement>;
    hooks: Array<ChatElement>;
    middlewares: Array<ChatElement>;
    tags: Array<ChatElement>;
  };
  retryLastResponse: () => void;
  canRetry: boolean;
  // Optional docs context sources
  docsRunner?: string;
  docsSchema?: string;
  docsProjectOverview?: string;
  docsRunnerDev?: string;
}

interface TagSuggestion {
  id: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  chatState,
  setChatState,
  sendMessage,
  sendMessageWithText,
  stopRequest,
  onTaggedElementSelect,
  availableElements,
  retryLastResponse,
  canRetry,
  docsRunner,
  docsSchema,
  docsProjectOverview,
  docsRunnerDev,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [tagQuery, setTagQuery] = useState("");
  const [tagStartPosition, setTagStartPosition] = useState(-1);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [showDocsMenu, setShowDocsMenu] = useState(false);

  // Auto-focus textarea when component mounts
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, []);

  // Handle message sending with context toggles
  const handleSendMessage = useCallback(async () => {
    if (
      !chatState.inputValue.trim() ||
      chatState.isTyping ||
      isProcessingMessage
    ) {
      return;
    }
    // Toggle @docs.* flags at the thread level and remove them from the outgoing text
    setIsProcessingMessage(true);
    try {
      const raw = chatState.inputValue;
      const tokenRe =
        /\s*@docs\.(runnerDev|runner|schema|projectOverview|fullContext|clear)\b/g;
      const found: string[] = [];
      raw.replace(tokenRe, (m) => {
        found.push(m.trim());
        return m;
      });
      if (found.length > 0) {
        setChatState((prev) => {
          const includes = { ...(prev.chatContext?.include || {}) };
          let cleared = false;
          for (const t of found) {
            if (t.endsWith("clear")) {
              includes.runner = false;
              includes.runnerDev = false;
              includes.schema = false;
              includes.projectOverview = false;
              cleared = true;
              continue;
            }
            if (t.endsWith("runner")) includes.runner = true;
            if (t.endsWith("runnerDev")) includes.runnerDev = true;
            if (t.endsWith("schema")) includes.schema = true;
            if (t.endsWith("projectOverview")) includes.projectOverview = true;
            if (t.endsWith("fullContext")) {
              includes.runner = true;
              includes.schema = true;
              includes.projectOverview = true;
            }
          }
          return { ...prev, chatContext: { include: includes } };
        });
      }
      const cleaned = raw
        .replace(tokenRe, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      // Build one-turn include override if tokens present
      const includeOverride =
        found.length > 0
          ? (() => {
              const includes = { ...(chatState.chatContext?.include || {}) };
              let cleared = false;
              for (const t of found) {
                if (t.endsWith("clear")) {
                  includes.runner = false;
                  includes.runnerDev = false;
                  includes.schema = false;
                  includes.projectOverview = false;
                  cleared = true;
                  continue;
                }
                if (t.endsWith("runner")) includes.runner = true;
                if (t.endsWith("runnerDev")) includes.runnerDev = true;
                if (t.endsWith("schema")) includes.schema = true;
                if (t.endsWith("projectOverview"))
                  includes.projectOverview = true;
                if (t.endsWith("fullContext")) {
                  includes.runner = true;
                  includes.schema = true;
                  includes.projectOverview = true;
                }
              }
              return includes;
            })()
          : undefined;
      if (found.length > 0) {
        // Build a friendly note of which contexts were toggled
        const ctxNames = found
          .filter((t) => !t.endsWith("clear"))
          .map((t) =>
            t.includes("fullContext")
              ? "Full Context (Runner + Project Overview + GraphQL Schema)"
              : t.includes("projectOverview")
              ? "Project Overview"
              : t.endsWith("runnerDev")
              ? "Runner-Dev"
              : t.endsWith("runner")
              ? "Runner"
              : t.endsWith("schema")
              ? "GraphQL Schema"
              : t.replace(/^@docs\./, "")
          );

        if (cleaned.length === 0) {
          // Show local acknowledgement and do not call the model
          setChatState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `ctx-${Date.now()}`,
                author: "bot",
                type: "text",
                text:
                  ctxNames.length > 0
                    ? `Context updated: ${ctxNames.join(", ")}`
                    : "Context cleared.",
                timestamp: Date.now(),
              },
            ],
            inputValue: "",
          }));
          return;
        }

        // If the remaining text is just a generic verb like "read" or "summarize",
        // translate it into a clear instruction for the model.
        const trimmed = cleaned.trim().toLowerCase();
        const isJustReadOrSummarize =
          /^(read|read it|read them|read this|summarize|summary)$/i.test(
            trimmed
          );
        if (isJustReadOrSummarize) {
          const summaryAsk = `Please read the provided docs context and give a concise, high-signal summary covering the most relevant points for development. Context enabled: ${ctxNames.join(
            ", "
          )}.`;
          sendMessageWithText(summaryAsk, raw, includeOverride);
          return;
        }
      }

      // Default: Send cleaned text to the model, display raw (with tokens) in UI, and pass includeOverride
      sendMessageWithText(cleaned, raw, includeOverride);
    } finally {
      setIsProcessingMessage(false);
    }
  }, [
    chatState.inputValue,
    chatState.isTyping,
    isProcessingMessage,
    sendMessageWithText,
    setChatState,
  ]);

  // Generate suggestions based on query
  const generateSuggestions = useCallback(
    (query: string): TagSuggestion[] => {
      if (query.length === 0) return [];

      const normalizedQuery = query.toLowerCase();
      const allSuggestions: TagSuggestion[] = [];

      // Check if query is for docs
      if (normalizedQuery.startsWith("docs")) {
        // Add docs suggestions
        let docsQuery = normalizedQuery.substring(4); // Remove "docs" prefix
        if (docsQuery.startsWith(".")) {
          docsQuery = docsQuery.substring(1); // Remove the dot as well
        }

        docsOptions.forEach((opt) => {
          const optName = opt.id.replace("docs.", ""); // Remove "docs." prefix for matching
          const fullName = opt.id; // Full name like "docs.projectOverview"

          // Match against both the full name and the option name
          if (
            docsQuery === "" ||
            optName.toLowerCase().includes(docsQuery) ||
            fullName.toLowerCase().includes(normalizedQuery)
          ) {
            allSuggestions.push({
              id: opt.id,
              name: opt.id,
              type: "docs",
              title: opt.title,
              description: opt.description,
            });
          }
        });
      } else if (availableElements) {
        // Add all available elements as suggestions
        Object.entries(availableElements).forEach(([type, elements]) => {
          elements.forEach((element) => {
            if (element.name.toLowerCase().includes(normalizedQuery)) {
              allSuggestions.push({
                id: element.id,
                name: element.name,
                type: type.slice(0, -1), // Remove 's' from plural (tasks -> task)
                title: element.title,
                description: element.description,
              });
            }
          });
        });
      }

      // Sort by relevance (exact match first, then starts with, then contains)
      return allSuggestions
        .sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();

          if (aName === normalizedQuery) return -1;
          if (bName === normalizedQuery) return 1;
          if (
            aName.startsWith(normalizedQuery) &&
            !bName.startsWith(normalizedQuery)
          )
            return -1;
          if (
            bName.startsWith(normalizedQuery) &&
            !aName.startsWith(normalizedQuery)
          )
            return 1;

          return aName.localeCompare(bName);
        })
        .slice(0, 10); // Limit to 10 suggestions
    },
    [availableElements]
  );

  // Handle input changes and detect @ mentions
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPosition = e.target.selectionStart;

      setChatState((prev) => ({ ...prev, inputValue: value }));

      // Find the last @ before cursor position
      const beforeCursor = value.substring(0, cursorPosition);
      const lastAtIndex = beforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        // Check if there's whitespace between @ and cursor
        const afterAt = beforeCursor.substring(lastAtIndex + 1);
        const hasWhitespace = /\s/.test(afterAt);

        if (!hasWhitespace) {
          // We're in a tag context
          const query = afterAt;
          const newSuggestions = generateSuggestions(query);

          setSuggestions(newSuggestions);
          setShowSuggestions(newSuggestions.length > 0);
          setTagQuery(query);
          setTagStartPosition(lastAtIndex);
          setSelectedSuggestionIndex(-1);
        } else {
          setShowSuggestions(false);
        }
      } else {
        setShowSuggestions(false);
      }
    },
    [setChatState, generateSuggestions]
  );

  // Handle suggestion selection
  const selectSuggestion = useCallback(
    (suggestion: TagSuggestion) => {
      if (tagStartPosition === -1) return;

      const currentValue = chatState.inputValue;
      const beforeTag = currentValue.substring(0, tagStartPosition);
      const afterTag = currentValue.substring(
        tagStartPosition + 1 + tagQuery.length
      );

      // Use clean element ID (type is already in the ID)
      const newValue = `${beforeTag}@${suggestion.name} ${afterTag}`;

      setChatState((prev) => ({ ...prev, inputValue: newValue }));
      setShowSuggestions(false);

      // Move cursor to position after the space
      const newCursorPosition =
        beforeTag.length + 1 + suggestion.name.length + 1;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(
            newCursorPosition,
            newCursorPosition
          );
          inputRef.current.focus();
        }
      }, 0);

      // Notify parent about tagged element selection
      onTaggedElementSelect?.(suggestion.id, suggestion.type);
    },
    [
      chatState.inputValue,
      tagStartPosition,
      tagQuery,
      setChatState,
      onTaggedElementSelect,
    ]
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> =
    useCallback(
      (e) => {
        // Handle suggestion navigation
        if (showSuggestions && suggestions.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedSuggestionIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0
            );
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedSuggestionIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1
            );
            return;
          }

          if (e.key === "Enter" || e.key === "Tab") {
            if (selectedSuggestionIndex >= 0) {
              e.preventDefault();
              selectSuggestion(suggestions[selectedSuggestionIndex]);
              return;
            }
          }

          if (e.key === "Escape") {
            e.preventDefault();
            setShowSuggestions(false);
            return;
          }
        }

        // Regular keyboard shortcuts
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSendMessage();
        } else if (e.key === "Enter" && !e.shiftKey && !showSuggestions) {
          e.preventDefault();
          handleSendMessage();
        } else if (e.key === "Escape") {
          // Stop request if active, otherwise clear input or unfocus
          if (chatState.canStop) {
            e.preventDefault();
            stopRequest();
          } else if (chatState.inputValue === "") {
            inputRef.current?.blur();
          }
        } else if (
          e.key === "ArrowUp" &&
          chatState.inputValue === "" &&
          !showSuggestions
        ) {
          // Edit last user message
          const lastUserMessage = [...chatState.messages]
            .reverse()
            .find((m) => m.author === "user" && m.type === "text");
          if (lastUserMessage && lastUserMessage.type === "text") {
            setChatState((prev) => ({
              ...prev,
              inputValue: lastUserMessage.text,
            }));
          }
        }
      },
      [
        showSuggestions,
        suggestions,
        selectedSuggestionIndex,
        selectSuggestion,
        handleSendMessage,
        chatState.canStop,
        chatState.inputValue,
        chatState.messages,
        setChatState,
        stopRequest,
      ]
    );

  // Close suggestions/menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".chat-input-container")) {
        setShowSuggestions(false);
        setShowDocsMenu(false);
      }
    };

    if (showSuggestions || showDocsMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showSuggestions, showDocsMenu]);

  // Docs quick-insert options (only include those with available data)
  const docsOptions = [
    docsRunner && docsProjectOverview && docsSchema && {
      id: "docs.fullContext",
      title: "Add Full Context",
      description: "Runner + Project Overview + GraphQL Schema (complete context)",
    },
    docsRunner && {
      id: "docs.runner",
      title: "Add Runner Context",
      description: "High-quality Runner docs context (AI.md)",
    },
    docsRunnerDev && {
      id: "docs.runnerDev",
      title: "Add Runner-Dev Docs",
      description: "Runner-Dev AI Assistant Guide (this toolkit)",
    },
    docsSchema && {
      id: "docs.schema",
      title: "Add GraphQL SDL",
      description: "Full GraphQL schema for complex queries",
    },
    docsProjectOverview && {
      id: "docs.projectOverview",
      title: "Add Project AI.md",
      description: "Project-specific AI guidelines/context",
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
  }>;

  const insertDocsToken = (id: string) => {
    const el = inputRef.current;
    const token = `@${id}`;
    setChatState((prev) => {
      const current = prev.inputValue || "";
      if (!el) {
        const next = current ? `${current} ${token} ` : `${token} `;
        return { ...prev, inputValue: next };
      }
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? start;
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
      const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
      const toInsert = `${needsLeadingSpace ? " " : ""}${token}${
        needsTrailingSpace ? " " : ""
      }`;
      const next = `${before}${toInsert}${after}`;
      // Update caret position after state update
      setTimeout(() => {
        try {
          const pos = (before + toInsert).length;
          el.focus();
          el.setSelectionRange(pos, pos);
        } catch {}
      }, 0);
      return { ...prev, inputValue: next };
    });
  };

  return (
    <div className="docs-chat-input">
      <div className="chat-input-container" style={{ position: "relative" }}>
        <textarea
          ref={inputRef}
          placeholder="Ask about code, request files, or get help... (Use @ to reference elements or @docs for context)"
          value={chatState.inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="chat-main-input"
          rows={3}
          style={{
            resize: "vertical",
            minHeight: "60px",
            maxHeight: "200px",
          }}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="chat-suggestions-dropdown">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.id}`}
                className={`chat-suggestion-item ${
                  index === selectedSuggestionIndex ? "selected" : ""
                }`}
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="suggestion-header">
                  <span className="suggestion-type">{suggestion.type}</span>
                  <span className="suggestion-name">{suggestion.name}</span>
                </div>
                {(suggestion.title || suggestion.description) && (
                  <div className="suggestion-meta">
                    {suggestion.title && (
                      <div className="suggestion-title">{suggestion.title}</div>
                    )}
                    {suggestion.description && (
                      <div className="suggestion-description">
                        {suggestion.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="chat-button-group">
          {/* Quick insert (dropdown) */}
          <div className="docs-insert-wrapper">
            <button
              onClick={() => setShowDocsMenu((v) => !v)}
              className="chat-insert-btn docs-insert-btn"
              title="Add context"
              disabled={docsOptions.length === 0}
            >
              <span className="insert-icon">＋</span>
            </button>
            {showDocsMenu && docsOptions.length > 0 && (
              <div className="chat-docs-menu">
                {docsOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className="chat-docs-menu__item"
                    onClick={() => {
                      insertDocsToken(opt.id);
                      setShowDocsMenu(false);
                      // Focus back to input for continued typing
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                  >
                    <div className="chat-docs-menu__item-title">
                      {opt.title}
                    </div>
                    <div className="chat-docs-menu__item-desc">
                      {opt.description}
                    </div>
                    <div className="chat-docs-menu__item-id">@{opt.id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {chatState.canStop ? (
            <button
              onClick={stopRequest}
              className="chat-send-btn chat-send-btn--stop"
              title="Stop generating response"
            >
              <span className="send-text">Stop</span>
            </button>
          ) : (
            <>
              {canRetry && (
                <button
                  onClick={retryLastResponse}
                  className="chat-send-btn chat-send-btn--retry"
                  disabled={chatState.isTyping || isProcessingMessage}
                  title="Retry last response"
                >
                  <span className="send-text">↻</span>
                </button>
              )}
              <button
                onClick={handleSendMessage}
                className="chat-send-btn"
                disabled={
                  !chatState.inputValue.trim() ||
                  chatState.isTyping ||
                  isProcessingMessage
                }
                title="Send message (Enter or Ctrl+Enter)"
              >
                <span className="send-text">
                  {isProcessingMessage ? "Processing..." : "Send"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="chat-input-hints">
        <span className="hint">
          💡 Press Enter or Ctrl+Enter to send • Shift+Enter for new line
          {chatState.canStop ? " • Escape to stop" : ""} • @ to reference
          elements or @docs for context
        </span>
      </div>
    </div>
  );
};
