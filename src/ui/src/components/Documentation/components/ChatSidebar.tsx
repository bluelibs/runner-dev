import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { CodeModal } from "./CodeModal";
import { ChatState, CodeModalState, FileReference, FileDiff } from "./ChatTypes";
import { useChatState } from "./useChatState";
import { 
  formatRelativeTime, 
  copyToClipboard, 
  parseMessageForFiles, 
  getThinkingText,
  generateUnifiedDiff 
} from "./ChatUtils";
import "./ChatSidebar.scss";

export interface ChatSidebarProps {
  width: number;
  sidebarRef: React.RefObject<HTMLElement>;
}


export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  width,
  sidebarRef,
}) => {
  const { chatState, setChatState, sendMessage, clearChat } = useChatState();
  
  const [codeModal, setCodeModal] = useState<CodeModalState>({
    isOpen: false,
    title: "",
    content: ""
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, [chatState.messages.length]);

  // Modal handlers
  const openFileModal = useCallback((file: FileReference, title: string) => {
    setCodeModal({
      isOpen: true,
      title,
      subtitle: file.fileName,
      content: file.content,
      language: file.language
    });
  }, []);

  const openDiffModal = useCallback((diff: FileDiff) => {
    setCodeModal({
      isOpen: true,
      title: `Diff: ${diff.fileName}`,
      subtitle: "Unified diff format",
      content: diff.diffText || generateUnifiedDiff(diff.previousVersion, diff.newVersion, diff.fileName),
      language: "diff"
    });
  }, []);

  const closeModal = useCallback(() => {
    setCodeModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === "Escape") {
      setChatState(prev => ({ ...prev, searchQuery: "", isSearching: false }));
    } else if (e.key === "ArrowUp" && chatState.inputValue === "") {
      // Edit last user message
      const lastUserMessage = [...chatState.messages].reverse().find(m => m.author === "user" && m.type === "text");
      if (lastUserMessage && lastUserMessage.type === "text") {
        setChatState(prev => ({ ...prev, inputValue: lastUserMessage.text }));
      }
    }
  }, [sendMessage, chatState.inputValue, chatState.messages, setChatState]);

  // Filtered messages for search functionality
  const filteredMessages = useMemo(() => {
    if (!chatState.searchQuery) return chatState.messages;
    
    return chatState.messages.filter(message => {
      if (message.type === "text") {
        return message.text.toLowerCase().includes(chatState.searchQuery.toLowerCase());
      } else if (message.type === "file") {
        return message.file.fileName.toLowerCase().includes(chatState.searchQuery.toLowerCase()) ||
               message.file.content.toLowerCase().includes(chatState.searchQuery.toLowerCase()) ||
               (message.text && message.text.toLowerCase().includes(chatState.searchQuery.toLowerCase()));
      } else if (message.type === "diff") {
        return message.diff.fileName.toLowerCase().includes(chatState.searchQuery.toLowerCase()) ||
               (message.text && message.text.toLowerCase().includes(chatState.searchQuery.toLowerCase()));
      }
      return false;
    });
  }, [chatState.messages, chatState.searchQuery]);

  return (
    <>
      <aside
      ref={sidebarRef}
      className="docs-chat-sidebar"
      style={{ width: `${width}px` }}
    >
        <div className="docs-chat-header">
          <div className="docs-chat-title">
            <h2>🤖 AI Assistant</h2>
            <div className="docs-chat-status">
              {chatState.isTyping ? (
                <span className="status-thinking">
                  {getThinkingText(chatState.thinkingStage)}...
                </span>
              ) : (
                <span className="status-ready">Ready</span>
              )}
            </div>
          </div>
          <div className="docs-chat-controls">
            <button
              className="chat-control-btn"
              onClick={() => setChatState(prev => ({ ...prev, isSearching: !prev.isSearching }))}
              title="Search messages"
            >
              🔍
            </button>
            <button
              className="chat-control-btn"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
                  clearChat();
                }
              }}
              title="Clear chat"
            >
              🗑️
            </button>
          </div>
        </div>
        
        {chatState.isSearching && (
          <div className="docs-chat-search">
            <input
              type="text"
              placeholder="Search messages..."
              value={chatState.searchQuery}
              onChange={(e) => setChatState(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="chat-search-input"
              autoFocus
            />
          </div>
        )}
        <div ref={scrollRef} className="docs-chat-messages">
          {filteredMessages.map((message) => {
            const isSelected = chatState.selectedMessageId === message.id;
            
            return (
              <div 
                key={message.id} 
                className={`chat-message chat-message--${message.author} ${isSelected ? 'chat-message--selected' : ''}`}
                onClick={() => setChatState(prev => ({
                  ...prev,
                  selectedMessageId: prev.selectedMessageId === message.id ? null : message.id
                }))}
              >
                <div className="chat-message-header">
                  <span className="chat-message-author">
                    {message.author === "user" ? "You" : "AI"}
                  </span>
                  <span className="chat-message-time">
                    {formatRelativeTime(message.timestamp)}
                  </span>
                  {isSelected && (
                    <button
                      className="chat-message-copy"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (message.type === "text") {
                          copyToClipboard(message.text);
                        } else if (message.type === "file") {
                          copyToClipboard(message.file.content);
                        } else if (message.type === "diff") {
                          copyToClipboard(message.diff.diffText || 
                            generateUnifiedDiff(message.diff.previousVersion, message.diff.newVersion, message.diff.fileName)
                          );
                        }
                      }}
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                  )}
                </div>
                
                <div className="chat-bubble">
                  {message.type === "text" && (
                    <div className="message-text">
                      {parseMessageForFiles(message.text).map((part, idx) => (
                        <span key={idx}>
                          {part.type === "text" ? (
                            part.content
                          ) : (
                            <button
                              className="file-reference-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                // This would open the actual file - for demo, we'll simulate
                                openFileModal(
                                  {
                                    fileName: part.content,
                                    content: `// File: ${part.content}\n// This is a simulated file view\n// In production, this would load the actual file content`,
                                    language: "typescript"
                                  },
                                  `File: ${part.content}`
                                );
                              }}
                            >
                              [{part.content}]
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {message.type === "file" && (
                    <div className="message-file">
                      {message.text && <div className="message-text">{message.text}</div>}
                      <div 
                        className="file-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFileModal(message.file, `File: ${message.file.fileName}`);
                        }}
                      >
                        <div className="file-header">
                          <span className="file-icon">📄</span>
                          <span className="file-name">{message.file.fileName}</span>
                        </div>
                        <div className="file-snippet">
                          {message.file.content.split('\n').slice(0, 3).join('\n')}
                          {message.file.content.split('\n').length > 3 && '\n...'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {message.type === "diff" && (
                    <div className="message-diff">
                      {message.text && <div className="message-text">{message.text}</div>}
                      <div 
                        className="diff-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDiffModal(message.diff);
                        }}
                      >
                        <div className="diff-header">
                          <span className="diff-icon">🔄</span>
                          <span className="diff-file">{message.diff.fileName}</span>
                        </div>
                        <div className="diff-stats">
                          <span className="diff-additions">+{message.diff.newVersion.split('\n').length}</span>
                          <span className="diff-deletions">-{message.diff.previousVersion.split('\n').length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {chatState.isTyping && (
            <div className="chat-message chat-message--bot">
              <div className="chat-message-header">
                <span className="chat-message-author">AI</span>
                <span className="chat-message-time">Now</span>
              </div>
              <div className="chat-bubble">
                <div className="thinking-animation">
                  <div className="thinking-stage">{getThinkingText(chatState.thinkingStage)}</div>
                  <div className="thinking-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        <div className="docs-chat-input">
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about code, request files, or get help..."
              value={chatState.inputValue}
              onChange={(e) => setChatState(prev => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="chat-main-input"
            />
            <button 
              onClick={sendMessage} 
              className="chat-send-btn"
              disabled={!chatState.inputValue.trim() || chatState.isTyping}
              title="Send message (Enter)"
            >
              {chatState.isTyping ? "⏳" : "🚀"}
            </button>
          </div>
          <div className="chat-input-hints">
            <span className="hint">💡 Try: "Show me [filename]", "What changed in [file]?", or "Help with code"</span>
          </div>
        </div>
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
