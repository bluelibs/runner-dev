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

export interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  thinkingStage: "none" | "thinking" | "processing" | "generating";
  inputValue: string;
  searchQuery: string;
  isSearching: boolean;
  selectedMessageId: string | null;
}

export interface CodeModalState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  content: string;
  language?: string;
}