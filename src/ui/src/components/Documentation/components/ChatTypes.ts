export interface FileDiff {
  fileName: string;
  previousVersion: string;
  newVersion: string;
  diffText?: string;
}

export interface FileReference {
  fileName: string;
  content: string;
  language?: string;
}

export type MessageType = "text" | "file" | "diff";

export interface BaseChatMessage {
  id: string;
  author: "user" | "bot";
  timestamp: number;
  type: MessageType;
}

export interface TextMessage extends BaseChatMessage {
  type: "text";
  text: string;
  // Optional: the exact text sent to the model (may include hidden context like docs)
  hiddenText?: string;
}

export interface FileMessage extends BaseChatMessage {
  type: "file";
  file: FileReference;
  text?: string;
}

export interface DiffMessage extends BaseChatMessage {
  type: "diff";
  diff: FileDiff;
  text?: string;
}

export type ChatMessage = TextMessage | FileMessage | DiffMessage;

export type ResponseMode = "text" | "json";

export interface ChatSettings {
  openaiApiKey: string | null;
  model: string;
  stream: boolean;
  responseMode: ResponseMode;
  baseUrl: string | null;
  // UI/UX toggles
  enableShortcuts?: boolean;
  showTokenMeter?: boolean;
  virtualizeMessages?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  thinkingStage: "none" | "thinking" | "processing" | "generating";
  inputValue: string;
  searchQuery: string;
  isSearching: boolean;
  selectedMessageId: string | null;
  settings: ChatSettings;
  canStop: boolean;
  chatContext?: {
    include: {
      runner?: boolean;
      runnerDev?: boolean;
      schema?: boolean;
      projectOverview?: boolean;
    };
  };
  // Last known token usage reported by the model (if available)
  lastUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  // Snapshot of context token estimate taken right before sending
  preflightContext?: {
    system: number;
    history: number;
    input: number;
    tokens: number;
  } | null;
  // Sticky docs: once referenced, keep including until cleared
  stickyDocs?: {
    runner?: boolean;
    schema?: boolean;
    runnerDev?: boolean;
    projectOverview?: boolean;
  };
}

export interface CodeModalState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  content: string;
  language?: string;
}
