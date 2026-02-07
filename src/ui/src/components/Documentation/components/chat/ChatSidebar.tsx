import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { CodeModal } from "../CodeModal";
import { CodeModalState, FileReference, FileDiff } from "./ChatTypes";
import { useChatState } from "./useChatState";
import { useChatStateSmart } from "./useChatStateSmart";
import { ChatSettingsForm } from "../ChatSettingsForm";
import { ChatInput } from "../ChatInput";
import { generateUnifiedDiff } from "./ChatUtils";
import { SidebarHeader } from "../sidebar/SidebarHeader";
import { ClickOutside } from "../common/ClickOutside";
import "./ChatSidebar.scss";
import { useFilteredMessages } from "../../hooks/useFilteredMessages";
import { useAutoScroll } from "../../hooks/useAutoScroll";
import { ChatMessages } from "../messages/ChatMessages";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export interface ChatSidebarProps {
  width: number;
  sidebarRef: React.RefObject<HTMLElement>;
  isChatOpen: boolean;
  onToggleChat: () => void;
  runnerAiMd?: string;
  runnerDevMd?: string;
  projectOverviewMd?: string;
  graphqlSdl?: string;
  // Available elements for tagging
  availableElements?: {
    tasks: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    resources: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    events: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    hooks: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    middlewares: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    tags: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
  };
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  width,
  sidebarRef,
  isChatOpen,
  onToggleChat,
  runnerAiMd,
  runnerDevMd,
  projectOverviewMd,
  graphqlSdl,
  availableElements,
}) => {
  // Feature flag for Smart-based chat implementation
  // Note: useChatStateSmart is the preferred implementation. useChatState is deprecated.
  // To use Smart implementation by default, set REACT_APP_USE_SMART_CHAT=true or NEXT_PUBLIC_USE_SMART_CHAT=true
  // Or use URL parameter: ?useSmartChat=true
  const useSmartChat =
    process.env.REACT_APP_USE_SMART_CHAT === "true" ||
    process.env.NEXT_PUBLIC_USE_SMART_CHAT === "true" ||
    window.location.search.includes("useSmartChat=true");

  const chatHookData = useSmartChat
    ? useChatStateSmart({
        availableElements,
        docs: {
          runnerAiMd,
          graphqlSdl,
          runnerDevMd,
          projectOverviewMd,
        },
      })
    : useChatState({
        availableElements,
        docs: {
          runnerAiMd,
          graphqlSdl,
          runnerDevMd,
          projectOverviewMd,
        },
      });

  const {
    chatState,
    setChatState,
    sendMessage,
    sendMessageWithText,
    clearChat,
    updateSettings,
    testOpenAIConnection,
    stopRequest,
    retryLastResponse,
    tokenStatus,
  } = chatHookData;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [codeModal, setCodeModal] = useState<CodeModalState>({
    isOpen: false,
    title: "",
    content: "",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const filteredMessages = useFilteredMessages(
    chatState.messages,
    chatState.isTyping
  );

  const { isAtBottom: _isAtBottom, scrollToBottom: _scrollToBottom } =
    useAutoScroll(scrollRef, [filteredMessages, chatState.isTyping]);

  // Modal handlers
  const openFileModal = useCallback((file: FileReference, title: string) => {
    setCodeModal({
      isOpen: true,
      title,
      subtitle: file.fileName,
      content: file.content,
      language: file.language,
    });
  }, []);

  const openDiffModal = useCallback((diff: FileDiff) => {
    setCodeModal({
      isOpen: true,
      title: `Diff: ${diff.fileName}`,
      subtitle: "Unified diff format",
      content:
        diff.diffText ||
        generateUnifiedDiff(
          diff.previousVersion,
          diff.newVersion,
          diff.fileName
        ),
      language: "diff",
    });
  }, []);

  const closeModal = useCallback(() => {
    setCodeModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Keep refs to latest handlers/values so we can attach a single global listener
  const sendMessageWithTextRef =
    useRef<(messageText: string, displayText?: string) => void>(
      sendMessageWithText
    );
  const isChatOpenRef = useRef<boolean>(isChatOpen);
  const onToggleChatRef = useRef<() => void>(onToggleChat);

  useEffect(() => {
    sendMessageWithTextRef.current = sendMessageWithText;
    isChatOpenRef.current = isChatOpen;
    onToggleChatRef.current = onToggleChat;
  }, [sendMessageWithText, isChatOpen, onToggleChat]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail: any = (e as CustomEvent).detail || {};
      const messageText: string = detail.messageText || "";
      const displayText: string | undefined = detail.displayText || undefined;
      if (!messageText) return;
      // open chat panel if closed so user sees the message
      if (!isChatOpenRef.current) onToggleChatRef.current();
      sendMessageWithTextRef.current(messageText, displayText);
    };
    window.addEventListener("docs:add-to-ai", handler as EventListener);
    return () =>
      window.removeEventListener("docs:add-to-ai", handler as EventListener);
  }, []);

  // Handle tagged element selection
  const handleTaggedElementSelect = useCallback(
    (elementId: string, _elementType: string) => {
      // Clicks from external UI may want to insert a tag token into the input.
      // We'll append a simple @<id> token so ChatInput will pick it up consistently.
      setChatState((prev) => {
        const current = prev.inputValue || "";
        const token = `@${elementId}`;
        const next = current ? `${current} ${token} ` : `${token} `;
        return { ...prev, inputValue: next };
      });
    },
    [setChatState]
  );

  // Check if there's a last user message that can be retried
  const canRetry = useMemo(() => {
    const messages = chatState.messages;
    const lastUserMessageIndex = messages
      .map((m) => m.author)
      .lastIndexOf("user");
    return lastUserMessageIndex !== -1 && !chatState.isTyping;
  }, [chatState.messages, chatState.isTyping]);

  useKeyboardShortcuts({
    enabled: true,
    onToggleChat,
    onFocusInput: () => {
      const el = document.querySelector(
        ".docs-chat-input .chat-main-input"
      ) as HTMLTextAreaElement | null;
      el?.focus();
    },
    onSend: () => {
      if (!chatState.isTyping && (chatState.inputValue || "").trim()) {
        sendMessage();
      }
    },
    onStop: () => {
      if (chatState.canStop) stopRequest();
    },
    onClear: () => {
      if (
        window.confirm(
          "Are you sure you want to clear all chat history? This action cannot be undone."
        )
      ) {
        clearChat();
      }
    },
  });

  // Architect mode removed

  // Close settings on ESC when panel is open
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSettingsOpen]);

  return (
    <>
      <aside
        ref={sidebarRef}
        className="docs-chat-sidebar"
        style={{ width: `${width}px` }}
        role="complementary"
        aria-label="AI chat"
      >
        <SidebarHeader
          icon=""
          title="Runtime AI (beta)"
          className="sidebar-header--chat"
          status={
            <>
              {chatState.isTyping ? (
                <span className="status-thinking">Thinking...</span>
              ) : (
                <span className="status-ready">Ready</span>
              )}
              <span
                className="status-sep"
                style={{ margin: "0 8px", opacity: 0.5 }}
              >
                |
              </span>
              {(() => {
                const title =
                  tokenStatus.mode === "context"
                    ? `System: ${tokenStatus.breakdown.system} • History: ${tokenStatus.breakdown.history} • Input: ${tokenStatus.breakdown.input}`
                    : chatState.lastUsage
                    ? `Prompt: ${chatState.lastUsage.promptTokens} • Completion: ${chatState.lastUsage.completionTokens} • Total: ${chatState.lastUsage.totalTokens}`
                    : "";
                return (
                  <span className="status-context" title={title}>
                    {tokenStatus.mode === "context" ? (
                      <>Context: {tokenStatus.total}</>
                    ) : (
                      <>Tokens: {tokenStatus.total}</>
                    )}
                  </span>
                );
              })()}
            </>
          }
          actions={
            <>
              <button
                className="sidebar-header__action-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsSettingsOpen((v) => !v);
                }}
                title="Settings"
              >
                ⚙️
              </button>
              {/* <button
                className={`sidebar-header__action-btn ${
                  mode === "chat" ? "active" : ""
                }`}
                title="Chat Mode"
                onClick={() => setMode("chat")}
              >
                💬
              </button> */}
              {/* <button
                className={`sidebar-header__action-btn ${
                  mode === "architect" ? "active" : ""
                }`}
                title="Architect Mode"
                onClick={() => setMode("architect")}
              >
                🏗️
              </button> */}
              <button
                className="sidebar-header__action-btn sidebar-header__action-btn--destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to clear all chat history? This action cannot be undone."
                    )
                  ) {
                    clearChat();
                  }
                }}
                title="Clear chat"
              >
                🗑️
              </button>
            </>
          }
        />

        {isSettingsOpen && (
          <ClickOutside
            className="docs-chat-settings"
            style={{
              padding: "12px",
              borderTop: "1px solid #eee",
              borderBottom: "1px solid #eee",
            }}
            onClickOutside={(event) => {
              // Don't close if clicking the settings button itself
              if (event) {
                const target = event.target as Element;
                if (target?.closest('button[title="Settings"]')) {
                  return;
                }
              }
              setIsSettingsOpen(false);
            }}
          >
            <ChatSettingsForm
              settings={chatState.settings}
              onSave={(values) => {
                updateSettings(values);
                setIsSettingsOpen(false);
              }}
              onTest={(key, baseUrl) => testOpenAIConnection(key, baseUrl)}
              onClearKey={() => updateSettings({ openaiApiKey: null })}
            />
          </ClickOutside>
        )}

        <>
          <div ref={scrollRef} className="docs-chat-messages">
            <ChatMessages
              messages={filteredMessages}
              isTyping={chatState.isTyping}
              thinkingStage={
                chatState.thinkingStage !== "none"
                  ? chatState.thinkingStage
                  : undefined
              }
              toolCalls={chatState.toolCalls}
              onOpenFile={openFileModal}
              onOpenDiff={openDiffModal}
            />
            <div ref={messagesEndRef} style={{ height: "20px" }} />
          </div>
          <ChatInput
            chatState={chatState}
            setChatState={setChatState}
            sendMessage={sendMessage}
            sendMessageWithText={sendMessageWithText}
            stopRequest={stopRequest}
            onTaggedElementSelect={handleTaggedElementSelect}
            availableElements={availableElements}
            retryLastResponse={retryLastResponse}
            canRetry={canRetry}
            docsRunner={runnerAiMd}
            docsSchema={graphqlSdl}
            docsProjectOverview={projectOverviewMd}
            docsRunnerDev={runnerDevMd}
          />
        </>
      </aside>

      <CodeModal
        title={codeModal.title}
        subtitle={codeModal.subtitle}
        isOpen={codeModal.isOpen}
        onClose={closeModal}
        code={codeModal.content}
      />
    </>
  );
};
