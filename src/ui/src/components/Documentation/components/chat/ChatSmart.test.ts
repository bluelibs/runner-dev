import { ChatSmart } from "./ChatSmart";
import type { DocsBundle, AvailableElements } from "./ChatTypes";

// Mock dependencies
jest.mock("./ChatUtils", () => ({
  saveChatHistory: jest.fn(),
  loadChatHistory: jest.fn(() => null),
  saveChatSettings: jest.fn(),
  loadChatSettings: jest.fn(() => null),
  saveChatContext: jest.fn(),
  loadChatContext: jest.fn(() => null),
  computeContextEstimateFromContext: jest.fn(() => ({
    system: 100,
    history: 200,
    input: 50,
    total: 350,
  })),
  buildRequestMessages: jest.fn(() => []),
  expandDocsInMessage: jest.fn((text) => ({
    modelText: text,
    displayText: text,
  })),
  generateUnifiedDiff: jest.fn(() => "mock diff"),
}));

jest.mock("./ai.service", () => ({
  streamChatCompletion: jest.fn(),
  createToolCallAccumulator: jest.fn(() => ({
    accept: jest.fn(),
    list: jest.fn(() => []),
  })),
  buildOpenAiTools: jest.fn(() => []),
  testOpenAIConnection: jest.fn(),
}));

jest.mock("./ai.tools", () => ({
  createTools: jest.fn(() => []),
}));

jest.mock("./ai.systemPrompt", () => ({
  SYSTEM_PROMPT: "You are a helpful assistant.",
}));

describe("ChatSmart", () => {
  let chatSmart: ChatSmart;
  let mockDocsBundle: DocsBundle;
  let mockAvailableElements: AvailableElements;

  beforeEach(() => {
    mockDocsBundle = {
      runnerAiMd: null,
      graphqlSdl: null,
      runnerDevMd: null,
      projectOverviewMd: null,
    };

    mockAvailableElements = {
      tasks: [],
      resources: [],
      events: [],
      hooks: [],
      middlewares: [],
      tags: [],
    };

    chatSmart = new ChatSmart(mockDocsBundle, mockAvailableElements);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    test("should initialize with default state", () => {
      expect(chatSmart.messages).toHaveLength(1); // Welcome message
      expect(chatSmart.messages[0].author).toBe("bot");
      expect(chatSmart.messages[0].type).toBe("text");
      expect(chatSmart.isTyping).toBe(false);
      expect(chatSmart.thinkingStage).toBe("none");
      expect(chatSmart.inputValue).toBe("");
      expect(chatSmart.settings.model).toBe("gpt-5-mini");
    });

    test("should accept docs bundle and available elements", () => {
      expect(chatSmart.docsBundle).toBe(mockDocsBundle);
      expect(chatSmart.availableElements).toBe(mockAvailableElements);
    });
  });

  describe("Message Management", () => {
    test("should send message and create assistant placeholder", async () => {
      const mockStreamChatCompletion =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("./ai.service").streamChatCompletion;
      mockStreamChatCompletion.mockImplementation(async (req, handlers) => {
        handlers.onTextDelta("Hello");
        handlers.onFinish("Hello");
      });

      chatSmart.settings.openaiApiKey = "test-key";
      await chatSmart.sendMessage("Hello");

      expect(chatSmart.messages).toHaveLength(3); // welcome + user + assistant
      expect(chatSmart.messages[1].author).toBe("user");
      expect(chatSmart.messages[1].text).toBe("Hello");
      expect(chatSmart.messages[2].author).toBe("bot");
      expect(chatSmart.isTyping).toBe(false); // Should be false after completion
      expect(chatSmart.inputValue).toBe("");
    });

    test("should show error when no API key", async () => {
      // Create a fresh instance for this test to avoid test interference
      const freshChatSmart = new ChatSmart(
        mockDocsBundle,
        mockAvailableElements
      );
      const mockStreamChatCompletion =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("./ai.service").streamChatCompletion;

      // Ensure API key is null (in case it was loaded from persisted state)
      freshChatSmart.settings.openaiApiKey = null;

      // Reset mock completely (not just call counts)
      mockStreamChatCompletion.mockReset();

      await freshChatSmart.sendMessage("Hello");

      // Should only have welcome + error message (no user or assistant messages)
      expect(freshChatSmart.messages).toHaveLength(2); // welcome + error
      expect(freshChatSmart.messages[0].author).toBe("bot");
      expect(freshChatSmart.messages[0].id).toBe("welcome");
      expect(freshChatSmart.messages[1].author).toBe("bot");
      expect(freshChatSmart.messages[1].text).toContain(
        "OpenAI API key is required"
      );
      expect(freshChatSmart.isTyping).toBe(false);

      // Ensure streaming was not called
      expect(mockStreamChatCompletion).not.toHaveBeenCalled();
    });

    test("should clear chat", () => {
      chatSmart.messages.push({
        id: "test-message",
        author: "user",
        type: "text",
        text: "Test",
        timestamp: Date.now(),
      });

      chatSmart.clearChat();

      expect(chatSmart.messages).toHaveLength(1);
      expect(chatSmart.messages[0].id).toBe("welcome");
    });
  });

  describe("Settings Management", () => {
    test("should update settings", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const persistSpy = jest.spyOn(require("./ChatUtils"), "saveChatSettings");

      chatSmart.updateSettings({ model: "gpt-4", temperature: 0.5 });

      expect(chatSmart.settings.model).toBe("gpt-4");
      expect(persistSpy).toHaveBeenCalled();
    });

    test("should test OpenAI connection", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mockTestConnection = require("./ai.service").testOpenAIConnection;
      mockTestConnection.mockResolvedValue({ ok: true });

      chatSmart.settings.openaiApiKey = "test-key";
      chatSmart.settings.model = "gpt-4";

      const result = await chatSmart.testOpenAIConnection();

      expect(result.ok).toBe(true);
      expect(mockTestConnection).toHaveBeenCalledWith({
        apiKey: "test-key",
        model: "gpt-4",
        baseUrl: "https://api.openai.com",
      });
    });
  });

  describe("UI State Management", () => {
    test("should set input value", () => {
      chatSmart.setInputValue("test input");

      expect(chatSmart.inputValue).toBe("test input");
    });

    test("should set search query", () => {
      chatSmart.setSearchQuery("test search");

      expect(chatSmart.searchQuery).toBe("test search");
      expect(chatSmart.isSearching).toBe(true);
    });

    test("should set selected message ID", () => {
      chatSmart.setSelectedMessageId("msg-123");

      expect(chatSmart.selectedMessageId).toBe("msg-123");
    });
  });

  describe("Context Management", () => {
    test("should update chat context", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const persistSpy = jest.spyOn(require("./ChatUtils"), "saveChatContext");

      chatSmart.updateChatContext({ runner: true, schema: true });

      expect(chatSmart.chatContext.include.runner).toBe(true);
      expect(chatSmart.chatContext.include.schema).toBe(true);
      expect(persistSpy).toHaveBeenCalled();
    });

    test("should update sticky docs", () => {
      chatSmart.updateStickyDocs({ runnerDev: true });

      expect(chatSmart.stickyDocs.runnerDev).toBe(true);
    });
  });

  describe("Deep Implementation", () => {
    test("should enable deep implementation", () => {
      chatSmart.enableDeepImplementation();

      expect(chatSmart.deepImpl.enabled).toBe(true);
      expect(chatSmart.deepImpl.flowId).toBeTruthy();
      expect(chatSmart.deepImpl.flowStage).toBe("questions");
    });

    test("should set deep impl answers", async () => {
      const mockStreamChatCompletion =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("./ai.service").streamChatCompletion;
      mockStreamChatCompletion.mockImplementation(async (req, handlers) => {
        handlers.onTextDelta("Response");
        handlers.onFinish("Response");
      });

      chatSmart.enableDeepImplementation();
      chatSmart.settings.openaiApiKey = "test-key";

      await chatSmart.setDeepImplAnswers({
        purpose: "test purpose",
        constraints: "test constraints",
        success: "test success",
      });

      expect(chatSmart.deepImpl.answers.purpose).toBe("test purpose");
      expect(chatSmart.deepImpl.answers.constraints).toBe("test constraints");
      expect(chatSmart.deepImpl.answers.success).toBe("test success");
      expect(chatSmart.deepImpl.flowStage).toBe("plan");
    });
  });

  describe("Computed Properties", () => {
    test("should compute canRetry correctly", () => {
      expect(chatSmart.canRetry).toBe(false); // No user messages

      chatSmart.messages.push({
        id: "user-msg",
        author: "user",
        type: "text",
        text: "Test",
        timestamp: Date.now(),
      });

      expect(chatSmart.canRetry).toBe(true);

      chatSmart.isTyping = true;
      expect(chatSmart.canRetry).toBe(false); // Can't retry while typing
    });

    test("should compute token status", () => {
      const status = chatSmart.tokenStatus;

      expect(status).toHaveProperty("mode");
      expect(status).toHaveProperty("total");
      expect(status).toHaveProperty("breakdown");
    });

    test("should compute live estimate", () => {
      const estimate = chatSmart.liveEstimate;

      expect(estimate).toHaveProperty("system");
      expect(estimate).toHaveProperty("history");
      expect(estimate).toHaveProperty("input");
      expect(estimate).toHaveProperty("total");
    });
  });

  describe("State Export", () => {
    test("should export state as ChatState", () => {
      const state = chatSmart.getStateAsChatState();

      expect(state).toHaveProperty("messages");
      expect(state).toHaveProperty("isTyping");
      expect(state).toHaveProperty("thinkingStage");
      expect(state).toHaveProperty("inputValue");
      expect(state).toHaveProperty("settings");
      // ... verify all ChatState properties exist
    });
  });
});
