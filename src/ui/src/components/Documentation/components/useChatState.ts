import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatState, ChatMessage, TextMessage, FileMessage, DiffMessage } from './ChatTypes';
import { generateUnifiedDiff, saveChatHistory, loadChatHistory } from './ChatUtils';

const initialChatState: ChatState = {
  messages: [
    {
      id: "welcome",
      author: "bot",
      type: "text",
      text: "Hi! I'm your AI assistant. I can help with code, show file differences, and much more. Try asking me about your project!",
      timestamp: Date.now(),
    },
  ],
  isTyping: false,
  thinkingStage: "none",
  inputValue: "",
  searchQuery: "",
  isSearching: false,
  selectedMessageId: null,
};

export const useChatState = () => {
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const pendingBotTimeout = useRef<number | null>(null);

  // Load persisted chat history on mount
  useEffect(() => {
    const savedMessages = loadChatHistory();
    if (savedMessages && savedMessages.length > 0) {
      setChatState(prev => ({ ...prev, messages: savedMessages }));
    }
  }, []);

  // Persist chat history
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveChatHistory(chatState.messages);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chatState.messages]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (pendingBotTimeout.current) {
        window.clearTimeout(pendingBotTimeout.current);
      }
    };
  }, []);

  const simulateBotResponse = useCallback((userMessage: string) => {
    if (pendingBotTimeout.current) {
      window.clearTimeout(pendingBotTimeout.current);
    }

    setChatState(prev => ({ ...prev, isTyping: true, thinkingStage: "thinking" }));

    // Thinking animation stages
    const stages: Array<ChatState['thinkingStage']> = ["thinking", "processing", "generating"];
    let currentStageIndex = 0;

    const stageInterval = setInterval(() => {
      currentStageIndex = (currentStageIndex + 1) % stages.length;
      setChatState(prev => ({ ...prev, thinkingStage: stages[currentStageIndex] }));
    }, 1500);

    pendingBotTimeout.current = window.setTimeout(() => {
      clearInterval(stageInterval);
      
      let botResponse: ChatMessage;
      
      // Simulate different response types based on message content
      if (userMessage.toLowerCase().includes('file') || userMessage.toLowerCase().includes('code')) {
        // File response simulation
        botResponse = {
          id: `b-${Date.now()}`,
          author: "bot",
          type: "file",
          file: {
            fileName: "example.ts",
            content: `// Example TypeScript file
interface User {
  id: string;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  getUser(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }
}`,
            language: "typescript"
          },
          text: "Here's an example TypeScript file. Click to view in modal.",
          timestamp: Date.now(),
        } as FileMessage;
      } else if (userMessage.toLowerCase().includes('diff') || userMessage.toLowerCase().includes('change')) {
        // Diff response simulation
        const prevContent = `function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price;
  }
  return total;
}`;
        
        const newContent = `function calculateTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return Math.round(total * 100) / 100;
}`;
        
        botResponse = {
          id: `b-${Date.now()}`,
          author: "bot",
          type: "diff",
          diff: {
            fileName: "utils.ts",
            previousVersion: prevContent,
            newVersion: newContent,
            diffText: generateUnifiedDiff(prevContent, newContent, "utils.ts")
          },
          text: "I've updated the function with TypeScript types and quantity calculation. Click to see the diff.",
          timestamp: Date.now(),
        } as DiffMessage;
      } else {
        // Regular text response
        const responses = [
          "That's interesting! I can help you with that. What specific aspect would you like to explore?",
          "Great question! Let me think about the best approach for this.",
          "I understand what you're looking for. Here are some suggestions...",
          "Excellent! I can definitely assist you with that. Let me provide some insights.",
          "That's a good point. Let me break this down for you step by step."
        ];
        
        botResponse = {
          id: `b-${Date.now()}`,
          author: "bot",
          type: "text",
          text: responses[Math.floor(Math.random() * responses.length)],
          timestamp: Date.now(),
        } as TextMessage;
      }
      
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, botResponse],
        isTyping: false,
        thinkingStage: "none"
      }));
    }, 3000 + Math.random() * 2000); // Variable response time
  }, []);

  const sendMessage = useCallback(() => {
    const trimmed = chatState.inputValue.trim();
    if (!trimmed) return;
    
    const userMsg: TextMessage = {
      id: `m-${Date.now()}`,
      author: "user",
      type: "text",
      text: trimmed,
      timestamp: Date.now(),
    };
    
    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      inputValue: ""
    }));

    simulateBotResponse(trimmed);
  }, [chatState.inputValue, simulateBotResponse]);

  const clearChat = useCallback(() => {
    localStorage.removeItem('chat-sidebar-history');
    setChatState(prev => ({
      ...prev,
      messages: [{
        id: "welcome",
        author: "bot",
        type: "text",
        text: "Chat history cleared. How can I help you?",
        timestamp: Date.now(),
      } as TextMessage]
    }));
  }, []);

  return {
    chatState,
    setChatState,
    sendMessage,
    clearChat,
  };
};