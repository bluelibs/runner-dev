import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { CodeModal } from "./CodeModal";
import {
  CodeModalState,
  FileReference,
  FileDiff,
  TextMessage,
} from "./ChatTypes";
import { useChatState } from "./useChatState";
import { ChatSettingsForm } from "./ChatSettingsForm";
import { ChatInput } from "./ChatInput";
import { generateUnifiedDiff } from "./ChatUtils";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import "./ChatSidebar.scss";
import { useFilteredMessages } from "../hooks/useFilteredMessages";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { ChatMessages } from "./messages/ChatMessages";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { ArchitectPanel } from "./ArchitectPanel";
import type { ArchitectPanelHandle } from "./ArchitectPanel";

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
  } = useChatState({
    availableElements,
    docs: {
      runnerAiMd,
      graphqlSdl,
      runnerDevMd,
      projectOverviewMd,
    },
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "architect">("chat");

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

  const { isAtBottom, scrollToBottom } = useAutoScroll(
    sidebarRef as unknown as React.RefObject<HTMLDivElement>,
    [filteredMessages, chatState.isTyping]
  );

  const architectRef = useRef<ArchitectPanelHandle | null>(null);

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

  // Handle tagged element selection
  const handleTaggedElementSelect = useCallback(
    (elementId: string, elementType: string) => {
      console.log(`Tagged element: ${elementType}:${elementId}`);
    },
    []
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
      if (mode === "chat") {
        if (!chatState.isTyping && (chatState.inputValue || "").trim()) {
          sendMessage();
        }
      } else {
        const text = (chatState.inputValue || "").trim();
        if (text && architectRef.current) {
          architectRef.current.plan(text);
          setChatState((prev) => ({ ...prev, inputValue: "" }));
        }
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

  // Architect-mode send handlers that reuse ChatInput UI
  const architectSend = useCallback(() => {
    const text = (chatState.inputValue || "").trim();
    if (!text || !architectRef.current) return;
    architectRef.current.plan(text);
    setChatState((prev) => ({ ...prev, inputValue: "" }));
  }, [chatState.inputValue, setChatState]);

  const architectSendWithText = useCallback(
    (messageText: string) => {
      if (!messageText.trim() || !architectRef.current) return;
      architectRef.current.plan(messageText.trim());
      setChatState((prev) => ({ ...prev, inputValue: "" }));
    },
    [setChatState]
  );

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
          icon="😼" // cat icon: 🐱 // cat icon: whiskers:
          title="Runtime AI"
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
                onClick={() => setIsSettingsOpen((v) => !v)}
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
          <div
            className="docs-chat-settings"
            style={{
              padding: "12px",
              borderTop: "1px solid #eee",
              borderBottom: "1px solid #eee",
            }}
          >
            <ChatSettingsForm
              settings={chatState.settings}
              onSave={(values) => updateSettings(values)}
              onTest={(key, baseUrl) => testOpenAIConnection(key, baseUrl)}
              onClearKey={() => updateSettings({ openaiApiKey: null })}
            />
          </div>
        )}

        {/* {mode === "architect" && (
          <>
            <ArchitectPanel
              ref={architectRef}
              settings={{
                openaiApiKey: chatState.settings.openaiApiKey,
                model: chatState.settings.model,
                baseUrl: chatState.settings.baseUrl,
              }}
              availableElements={availableElements}
              docs={{
                runnerAiMd,
                graphqlSdl,
                runnerDevMd,
                projectOverviewMd,
              }}
            />
            <ChatInput
              chatState={chatState}
              setChatState={setChatState}
              sendMessage={architectSend}
              sendMessageWithText={architectSendWithText}
              stopRequest={() => {}}
              onTaggedElementSelect={handleTaggedElementSelect}
              availableElements={availableElements}
              retryLastResponse={() => {}}
              canRetry={false}
              docsRunner={runnerAiMd}
              docsSchema={graphqlSdl}
              docsProjectOverview={projectOverviewMd}
              docsRunnerDev={runnerDevMd}
            />
          </>
        )} */}

        {mode === "chat" && (
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
        )}
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
