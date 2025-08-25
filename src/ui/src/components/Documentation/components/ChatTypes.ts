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
  // Optional: tools used to generate this assistant message
  toolCalls?: Array<{
    id: string;
    name?: string;
    argsPreview?: string;
    resultPreview?: string;
  }>;
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
  // Live tool-calls visualization while the assistant is processing
  toolCalls?: Array<{
    id: string;
    name?: string;
    argsPreview?: string;
    status: "pending" | "running" | "done" | "error";
    resultPreview?: string;
  }>;
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
  // Deep Implementation agentic flow state
  deepImpl?: DeepImplState;
}

export interface CodeModalState {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  content: string;
  language?: string;
}

// Deep Implementation types
export type PatchOp =
  | {
      kind: "file.update";
      path: string; // supports structured paths like workspace:src/...
      newContent: string;
      rationale?: string;
    }
  | {
      kind: "element.create";
      elementKind: "task" | "resource" | "hook" | "middleware" | "event";
      id: string;
      filePath: string;
      content: string;
      rationale?: string;
    }
  | {
      kind: "element.update";
      elementKind: "task" | "resource" | "hook" | "middleware" | "event";
      id: string;
      filePath: string;
      newContent: string;
      rationale?: string;
    }
  | {
      kind: "element.remove";
      elementKind: "task" | "resource" | "hook" | "middleware" | "event";
      id: string;
      filePath: string;
      rationale?: string;
    };

export interface DeepImplPatch {
  flowId: string;
  summary: string;
  questions: { purpose: string; constraints: string; success: string };
  ops: PatchOp[];
}

export interface DeepImplTodoItem {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  children?: DeepImplTodoItem[];
}

export interface DeepImplBudget {
  totalTokens: number; // overall cap for DeepResearch (eg. 65500)
  reserveOutput: number; // reserved tokens for final synthesis
  reserveSafety: number; // additional headroom
  perTurnMax?: number; // optional per-turn limit
  usedApprox?: number; // running estimate
}

export interface DeepImplState {
  enabled: boolean;
  flowId: string | null;
  flowStage:
    | "idle"
    | "questions"
    | "plan"
    | "explore"
    | "implement"
    | "patch.ready"
    | "applying"
    | "done";
  answers: { purpose?: string; constraints?: string; success?: string };
  todo: DeepImplTodoItem[];
  logs: Array<{ ts: number; text: string }>;
  patch?: DeepImplPatch | null;
  budget: DeepImplBudget;
  auto?: { running: boolean };
}
