import { Smart } from "@bluelibs/smart";
import * as React from "react";
import {
  ChatMessage,
  ChatSettings,
  ChatState,
  DeepImplState,
  TextMessage,
  TokenUsage,
  TokenEstimate,
  ToolCallInfo,
  AvailableElements,
} from "./ChatTypes";
import type { DocsBundle, DocsIncludeFlags } from "./ChatUtils";
import {
  streamChatCompletion,
  RegisteredTool,
  createToolCallAccumulator,
  buildOpenAiTools,
  testOpenAIConnection as testOpenAIConnectionApi,
  AccumulatedToolCall,
} from "./ai.service";
import {
  saveChatHistory,
  loadChatHistory,
  saveChatSettings,
  loadChatSettings,
  computeContextEstimateFromContext,
  buildRequestMessages,
  expandDocsInMessage,
  saveChatContext,
  loadChatContext,
} from "./ChatUtils";
import { createTools } from "./ai.tools";
import { SYSTEM_PROMPT } from "./ai.systemPrompt";

const defaultSettings: ChatSettings = {
  openaiApiKey: null,
  model: "gpt-5-mini",
  stream: true,
  responseMode: "text",
  baseUrl: "https://api.openai.com",
  enableShortcuts: true,
  showTokenMeter: true,
  virtualizeMessages: false,
};

const initialDeepImplState: DeepImplState = {
  enabled: false,
  flowId: null,
  flowStage: "idle",
  answers: {},
  todo: [],
  logs: [],
  patch: null,
  budget: {
    totalTokens: 65500,
    reserveOutput: 2000,
    reserveSafety: 1500,
    usedApprox: 0,
  },
  auto: { running: false },
  docs: {},
};

const createWelcomeMessage = (): TextMessage => ({
  id: "welcome",
  author: "bot",
  type: "text",
  text: "Hi! I'm your AI assistant. I can help with code, show file differences, and much more. Try asking me about your project!",
  timestamp: Date.now(),
});

export class ChatSmart extends Smart {
  static context = React.createContext<ChatSmart | null>(null);

  static getContext() {
    return this.context;
  }
  // ========================================
  // CORE STATE
  // ========================================

  // Message & Conversation State
  messages: ChatMessage[] = [createWelcomeMessage()];
  isTyping: boolean = false;
  thinkingStage: "none" | "thinking" | "processing" | "generating" = "none";
  lastUsage: TokenUsage | null = null;

  // UI State
  inputValue: string = "";
  searchQuery: string = "";
  isSearching: boolean = false;
  selectedMessageId: string | null = null;
  canStop: boolean = false;

  // Configuration & Context
  settings: ChatSettings = defaultSettings;
  chatContext: { include: DocsIncludeFlags } = {
    include: {
      runner: false,
      runnerDev: false,
      schema: false,
      projectOverview: false,
    },
  };
  stickyDocs: DocsIncludeFlags = {
    runner: false,
    runnerDev: false,
    schema: false,
    projectOverview: false,
  };
  preflightContext: TokenEstimate | null = null;

  // Tool Execution State
  toolCalls: ToolCallInfo[] = [];

  // Deep Implementation State
  deepImpl: DeepImplState = initialDeepImplState;

  // ========================================
  // EXTERNAL DEPENDENCIES
  // ========================================

  private docsBundle: DocsBundle;
  private availableElements: AvailableElements;
  private abortController: AbortController | null = null;

  constructor(docsBundle: DocsBundle, availableElements: AvailableElements) {
    super();
    this.docsBundle = docsBundle;
    this.availableElements = availableElements;
    this.loadPersistedState();
  }

  // ========================================
  // CORE MESSAGING METHODS
  // ========================================

  async sendMessage(content: string, displayText?: string): Promise<void> {
    if (!this.settings.openaiApiKey) {
      this.addErrorMessage(
        "❌ OpenAI API key is required. Please configure it in the settings to use the AI assistant."
      );
      return;
    }

    // Create abort controller
    this.abortController = new AbortController();

    // Capture preflight estimate
    this.capturePreflightEstimate(content);

    // Atomic state update
    const userMessage: TextMessage = {
      id: `m-${Date.now()}`,
      author: "user",
      type: "text",
      text: content,
      hiddenText: displayText,
      timestamp: Date.now(),
    };

    const assistantPlaceholder: TextMessage = {
      id: `b-${Date.now()}`,
      author: "bot",
      type: "text",
      text: "",
      timestamp: Date.now(),
    };

    // Update state atomically
    this.messages.push(userMessage, assistantPlaceholder);
    this.isTyping = true;
    this.thinkingStage = "thinking";
    this.canStop = true;
    this.inputValue = "";
    this.toolCalls = [];
    this.inform();

    try {
      await this.streamResponse(content, assistantPlaceholder.id);
    } catch (error: any) {
      this.handleStreamingError(error, assistantPlaceholder.id);
    }
  }

  async sendMessageWithText(
    messageText: string,
    displayText?: string
  ): Promise<void> {
    return this.sendMessage(messageText, displayText);
  }

  async retryLastResponse(): Promise<void> {
    const lastUserMessage = [...this.messages]
      .reverse()
      .find((m) => m.author === "user" && m.type === "text");

    if (!lastUserMessage) {
      this.addErrorMessage("No previous user message to retry");
      return;
    }

    // Remove last bot message and retry
    this.messages = this.messages.slice(0, -1);
    this.inform();

    return this.sendMessage((lastUserMessage as TextMessage).text);
  }

  stopRequest(): void {
    this.abortController?.abort();
    this.abortController = null;

    // Atomic cleanup
    this.isTyping = false;
    this.thinkingStage = "none";
    this.canStop = false;
    this.toolCalls = [];

    // Update last message to show stopped state
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.author === "bot") {
      lastMessage.text = "❌ Request stopped by user";
    }

    this.inform();
  }

  clearChat(): void {
    this.messages = [createWelcomeMessage()];
    this.lastUsage = null;
    this.preflightContext = null;
    this.deepImpl = initialDeepImplState;
    this.toolCalls = [];
    this.inform();

    this.persistChatHistory();
  }

  // ========================================
  // STREAMING IMPLEMENTATION
  // ========================================

  private async streamResponse(
    userInput: string,
    assistantMessageId: string
  ): Promise<void> {
    const accumulator = createToolCallAccumulator();
    let accumulatedText = "";

    // Build message history
    const historyMessages = this.messages
      .filter((m) => m.type === "text")
      .map((m) => ({
        role: m.author === "user" ? "user" : "assistant",
        content: (m as TextMessage).text || "",
      })) as any[];

    // Expand docs in message
    const expanded = expandDocsInMessage(userInput, this.docsBundle);

    // Build request messages
    const requestMessages = buildRequestMessages(
      SYSTEM_PROMPT,
      this.chatContext.include,
      historyMessages,
      expanded.modelText,
      this.docsBundle
    );

    // Create tools
    const tools = createTools(
      () => this.getStateForTools(),
      this.setStateFromTools.bind(this)
    );
    const openAiTools = buildOpenAiTools(tools);

    try {
      await streamChatCompletion(
        {
          settings: this.settings,
          messages: requestMessages,
          tools: openAiTools,
          signal: this.abortController?.signal,
        },
        {
          onTextDelta: (delta: string) => {
            accumulatedText += delta;
            this.updateAssistantMessage(assistantMessageId, accumulatedText);
            this.thinkingStage = "generating";
            this.inform();
          },

          onToolCallDelta: (delta: any) => {
            accumulator.accept(delta);
            this.updateToolCallsFromAccumulator(accumulator.list());
            this.thinkingStage = "processing";
            this.inform();
          },

          onFinish: (finalText: string, _finishReason?: string) => {
            this.finalizeMessage(
              assistantMessageId,
              finalText,
              accumulator.list()
            );
            this.isTyping = false;
            this.thinkingStage = "none";
            this.canStop = false;
            this.inform();

            this.persistChatHistory();

            // Handle Deep Implementation auto-continue
            if (this.deepImpl.enabled && this.deepImpl.auto?.running) {
              this.handleDeepImplAutoContinue();
            }
          },

          onError: (error: Error) => {
            this.handleStreamingError(error, assistantMessageId);
          },

          onUsage: (usage: any) => {
            this.lastUsage = {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            };
            this.inform();
          },
        }
      );

      // Execute tool calls if any
      if (accumulator.list().length > 0) {
        await this.executeToolCalls(
          accumulator.list(),
          tools,
          assistantMessageId
        );
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        this.handleStreamingError(error, assistantMessageId);
      }
    }
  }

  // ========================================
  // TOOL CALL MANAGEMENT
  // ========================================

  private async executeToolCalls(
    toolCalls: AccumulatedToolCall[],
    registeredTools: RegisteredTool[],
    assistantMessageId: string
  ): Promise<void> {
    // Set planned tool calls
    this.toolCalls = toolCalls.map((call, _index) => ({
      id: call.id,
      name: call.name,
      argsPreview: call.argsText,
      status: "pending" as const,
    }));
    this.inform();

    const toolResults: any[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const tool = registeredTools.find((t) => t.name === toolCall.name);

      if (!tool) {
        this.updateToolCallStatus(
          i,
          "error",
          `Tool not found: ${toolCall.name}`
        );
        continue;
      }

      this.updateToolCallStatus(i, "running");
      this.inform();

      try {
        const args = toolCall.argsText ? JSON.parse(toolCall.argsText) : {};
        const result = await tool.run(args);

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });

        this.updateToolCallStatus(
          i,
          "done",
          JSON.stringify(result).substring(0, 100)
        );
        this.inform();
      } catch (error: any) {
        this.updateToolCallStatus(i, "error", error.message);
        this.inform();

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error.message }),
        });
      }
    }

    // Attach tool calls to message
    this.attachToolCallsToMessage(
      assistantMessageId,
      toolCalls.map((tc, i) => ({
        id: tc.id,
        name: tc.name,
        argsPreview: tc.argsText,
        resultPreview: this.toolCalls[i]?.resultPreview,
      }))
    );

    // Continue conversation if needed
    if (toolResults.length > 0) {
      await this.continueWithToolResults(toolResults, assistantMessageId);
    }
  }

  // ========================================
  // SETTINGS & CONFIGURATION
  // ========================================

  updateSettings(partial: Partial<ChatSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.persistSettings();
    this.inform();
  }

  async testOpenAIConnection(): Promise<{ ok: boolean; error?: string }> {
    return testOpenAIConnectionApi({
      apiKey: this.settings.openaiApiKey!,
      model: this.settings.model,
      baseUrl: this.settings.baseUrl || undefined,
    });
  }

  // ========================================
  // CONTEXT MANAGEMENT
  // ========================================

  updateChatContext(include: Partial<DocsIncludeFlags>): void {
    this.chatContext.include = { ...this.chatContext.include, ...include };
    this.persistChatContext();
    this.inform();
  }

  updateStickyDocs(docs: Partial<DocsIncludeFlags>): void {
    this.stickyDocs = { ...this.stickyDocs, ...docs };
    this.inform();
  }

  // ========================================
  // DEEP IMPLEMENTATION METHODS
  // ========================================

  enableDeepImplementation(): void {
    this.deepImpl = {
      ...this.deepImpl,
      enabled: true,
      flowId: `flow-${Date.now()}`,
      flowStage: "questions",
    };
    this.inform();
  }

  async setDeepImplAnswers(answers: {
    purpose?: string;
    constraints?: string;
    success?: string;
  }): Promise<void> {
    this.deepImpl.answers = { ...this.deepImpl.answers, ...answers };
    this.deepImpl.flowStage = "plan";
    this.inform();

    await this.continueDeepImplFlow();
  }

  async continueDeepImplFlow(): Promise<void> {
    // Implementation for Deep Implementation flow
    // This would handle the complex agentic workflow
    // For now, we'll add a placeholder implementation
    if (!this.deepImpl.enabled) return;

    const continuePrompt = [
      "DEEPIMPL_CONTINUE",
      "Proceed with the next actionable step.",
      "If TODOs are complete, move to implement or finalize patch.",
    ].join("\n");

    await this.sendMessage(continuePrompt);
  }

  // ========================================
  // UI STATE HELPERS
  // ========================================

  setInputValue(value: string): void {
    this.inputValue = value;
    this.inform();
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.isSearching = query.length > 0;
    this.inform();
  }

  setSelectedMessageId(messageId: string | null): void {
    this.selectedMessageId = messageId;
    this.inform();
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private updateAssistantMessage(messageId: string, text: string): void {
    const message = this.messages.find((m) => m.id === messageId);
    if (message && message.type === "text") {
      message.text = text;
    }
  }

  private updateToolCallsFromAccumulator(calls: AccumulatedToolCall[]): void {
    this.toolCalls = calls.map((call) => ({
      id: call.id,
      name: call.name,
      argsPreview: call.argsText,
      status: "running" as const,
    }));
  }

  private updateToolCallStatus(
    index: number,
    status: "pending" | "running" | "done" | "error",
    resultPreview?: string
  ): void {
    if (this.toolCalls[index]) {
      this.toolCalls[index] = {
        ...this.toolCalls[index],
        status,
        ...(resultPreview && { resultPreview }),
      };
    }
  }

  private attachToolCallsToMessage(messageId: string, toolCalls: any[]): void {
    const message = this.messages.find((m) => m.id === messageId);
    if (message && message.type === "text") {
      message.toolCalls = toolCalls;
    }
  }

  private finalizeMessage(
    messageId: string,
    text: string,
    toolCalls: AccumulatedToolCall[]
  ): void {
    this.updateAssistantMessage(messageId, text);
    if (toolCalls.length > 0) {
      this.attachToolCallsToMessage(
        messageId,
        toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          argsPreview: tc.argsText,
        }))
      );
    }
  }

  private async continueWithToolResults(
    toolResults: any[],
    _assistantMessageId: string
  ): Promise<void> {
    // Continue the conversation with tool results
    // This is a simplified implementation
    const historyMessages = this.messages
      .filter((m) => m.type === "text")
      .map((m) => ({
        role: m.author === "user" ? "user" : "assistant",
        content: (m as TextMessage).text || "",
      }));

    // Add tool results to history
    historyMessages.push(...toolResults);

    // Continue the conversation
    // This would need more complex implementation for proper agentic flow
  }

  private handleDeepImplAutoContinue(): void {
    // Handle automatic continuation of Deep Implementation flow
    // Check budget, TODO completion, etc.
    const allDone = (this.deepImpl.todo || []).every((t) => {
      const doneOrError = (node: any): boolean => {
        const ok = node.status === "done" || node.status === "error";
        const children = Array.isArray(node.children) ? node.children : [];
        return ok && children.every(doneOrError);
      };
      return doneOrError(t);
    });

    if (
      allDone ||
      this.deepImpl.flowStage === "done" ||
      this.deepImpl.flowStage === "patch.ready"
    ) {
      this.deepImpl.auto = { running: false };
      this.inform();
      return;
    }

    // Check budget
    const total = this.deepImpl.budget?.totalTokens ?? 65500;
    const used = this.deepImpl.budget?.usedApprox ?? 0;
    const reserveOutput = this.deepImpl.budget?.reserveOutput ?? 2000;
    const reserveSafety = this.deepImpl.budget?.reserveSafety ?? 1500;
    const remaining = Math.max(0, total - used - reserveOutput - reserveSafety);

    if (remaining <= 0) {
      this.deepImpl.auto = { running: false };
      this.addErrorMessage(
        "Stopping Deep Implementation: token budget reached. Click Resume to continue with additional budget, or type 'continue' to proceed."
      );
      return;
    }

    // Trigger next step
    this.continueDeepImplFlow();
  }

  private addErrorMessage(text: string): void {
    const errorMessage: TextMessage = {
      id: `error-${Date.now()}`,
      author: "bot",
      type: "text",
      text,
      timestamp: Date.now(),
    };
    this.messages.push(errorMessage);
    this.inform();
  }

  private handleStreamingError(error: Error, messageId: string): void {
    if (error.name === "AbortError") {
      this.updateAssistantMessage(messageId, "❌ Request stopped by user");
    } else {
      this.updateAssistantMessage(
        messageId,
        `❌ Error: ${error.message || "Failed to contact OpenAI"}`
      );
    }

    this.isTyping = false;
    this.thinkingStage = "none";
    this.canStop = false;
    this.toolCalls = [];
    this.inform();
  }

  private capturePreflightEstimate(userInput: string): void {
    try {
      const historyStrings = (
        this.messages.filter((m) => m.type === "text") as TextMessage[]
      ).map((m) => m.text || "");

      const est = computeContextEstimateFromContext(
        SYSTEM_PROMPT,
        historyStrings,
        userInput,
        this.docsBundle,
        this.chatContext.include
      );

      this.preflightContext = {
        system: est.system,
        history: est.history,
        input: est.input,
        total: est.total,
        tokens: est.total,
        breakdown: {
          system: est.system,
          history: est.history,
          input: est.input,
        },
      };
    } catch {
      // Ignore estimation errors
    }
  }

  private getStateForTools(): any {
    return {
      messages: this.messages,
      settings: this.settings,
      chatContext: this.chatContext,
      deepImpl: this.deepImpl,
    };
  }

  private setStateFromTools(updates: any): void {
    Object.assign(this, updates);
    this.inform();
  }

  // ========================================
  // PERSISTENCE METHODS
  // ========================================

  private loadPersistedState(): void {
    try {
      const savedMessages = loadChatHistory();
      const savedSettings = loadChatSettings();
      const savedContext = loadChatContext();

      if (savedMessages?.length > 0) this.messages = savedMessages;
      if (savedSettings) this.settings = { ...this.settings, ...savedSettings };
      if (savedContext?.include)
        this.chatContext.include = {
          ...this.chatContext.include,
          ...savedContext.include,
        };
    } catch (error) {
      console.warn("Failed to load persisted state:", error);
    }
  }

  private persistChatHistory(): void {
    try {
      saveChatHistory(this.messages);
    } catch (error) {
      console.warn("Failed to persist chat history:", error);
    }
  }

  private persistSettings(): void {
    try {
      saveChatSettings(this.settings);
    } catch (error) {
      console.warn("Failed to persist settings:", error);
    }
  }

  private persistChatContext(): void {
    try {
      saveChatContext(this.chatContext);
    } catch (error) {
      console.warn("Failed to persist chat context:", error);
    }
  }

  // ========================================
  // COMPUTED PROPERTIES
  // ========================================

  get canRetry(): boolean {
    return this.messages.some((m) => m.author === "user") && !this.isTyping;
  }

  get tokenStatus(): {
    mode: "context" | "tokens";
    total: number;
    breakdown: { system: number; history: number; input: number };
  } {
    const hasInput = this.inputValue.trim().length > 0;
    const hasIncludes = Boolean(
      this.chatContext.include.runner ||
        this.chatContext.include.runnerDev ||
        this.chatContext.include.schema ||
        this.chatContext.include.projectOverview
    );
    const hasHistory =
      this.messages.filter((m) => m.type === "text" && m.id !== "welcome")
        .length > 0;

    // When there's no history, no input, and no sticky includes,
    // still show the system prompt tokens (never show 0).
    if (!hasHistory && !hasInput && !hasIncludes && !this.isTyping) {
      const liveEstimate = this.liveEstimate;
      return {
        mode: "context" as const,
        total: liveEstimate.system,
        breakdown: liveEstimate,
      };
    }

    // Show context estimate during typing, tokens after completion
    if (this.isTyping || hasInput) {
      const liveEstimate = this.liveEstimate;
      return {
        mode: "context" as const,
        total: liveEstimate.total,
        breakdown: liveEstimate,
      };
    }

    return {
      mode: "tokens" as const,
      total: this.lastUsage?.totalTokens || 0,
      breakdown: {
        system: 0,
        history: 0,
        input: this.lastUsage?.totalTokens || 0,
      },
    };
  }

  get liveEstimate(): TokenEstimate {
    const historyForEstimate: string[] = (
      this.messages
        .filter((m) => m.type === "text")
        // Exclude the special welcome/clear informational message from estimates
        .filter((m) => m.id !== "welcome") as TextMessage[]
    ).map((m) => (m as TextMessage).text || "");

    const estimate = computeContextEstimateFromContext(
      SYSTEM_PROMPT,
      historyForEstimate,
      this.inputValue,
      this.docsBundle,
      this.chatContext.include
    );

    return {
      ...estimate,
      tokens: estimate.total,
      breakdown: {
        system: estimate.system,
        history: estimate.history,
        input: estimate.input,
      },
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getStateAsChatState(): ChatState {
    return {
      messages: this.messages,
      isTyping: this.isTyping,
      thinkingStage: this.thinkingStage,
      inputValue: this.inputValue,
      searchQuery: this.searchQuery,
      isSearching: this.isSearching,
      selectedMessageId: this.selectedMessageId,
      settings: this.settings,
      canStop: this.canStop,
      toolCalls: this.toolCalls,
      chatContext: this.chatContext,
      lastUsage: this.lastUsage,
      preflightContext: this.preflightContext,
      stickyDocs: this.stickyDocs,
      deepImpl: this.deepImpl,
    };
  }
}
