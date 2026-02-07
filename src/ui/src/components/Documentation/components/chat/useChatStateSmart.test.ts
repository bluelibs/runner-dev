import { renderHook, act } from "@testing-library/react";
import { useChatStateSmart } from "./useChatStateSmart";
import type { DocsBundle, AvailableElements } from "./ChatTypes";

// Mock @bluelibs/smart
jest.mock("@bluelibs/smart", () => ({
  Smart: class MockSmart {
    constructor() {
      this.messages = [
        {
          id: "welcome",
          author: "bot",
          type: "text",
          text: "Welcome",
          timestamp: Date.now(),
        },
      ];
      this.isTyping = false;
      this.thinkingStage = "none";
      this.inputValue = "";
      this.searchQuery = "";
      this.isSearching = false;
      this.selectedMessageId = null;
      this.settings = { model: "gpt-5-mini", openaiApiKey: null };
      this.canStop = false;
      this.toolCalls = [];
      this.chatContext = {
        include: {
          runner: false,
          schema: false,
          projectOverview: false,
          runnerDev: false,
        },
      };
      this.lastUsage = null;
      this.preflightContext = null;
      this.stickyDocs = {
        runner: false,
        schema: false,
        projectOverview: false,
        runnerDev: false,
      };
      this.deepImpl = {
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
    }

    inform = jest.fn();
    getStateAsChatState = jest.fn(() => this);
    sendMessage = jest.fn();
    sendMessageWithText = jest.fn();
    retryLastResponse = jest.fn();
    stopRequest = jest.fn();
    clearChat = jest.fn();
    updateSettings = jest.fn();
    testOpenAIConnection = jest.fn();
    updateChatContext = jest.fn();
    updateStickyDocs = jest.fn();
    setInputValue = jest.fn();
    setSearchQuery = jest.fn();
    setSelectedMessageId = jest.fn();
    enableDeepImplementation = jest.fn();
    setDeepImplAnswers = jest.fn();
    continueDeepImplFlow = jest.fn();
    persistChatHistory = jest.fn();

    get canRetry() {
      return false;
    }
    get tokenStatus() {
      return {
        mode: "tokens",
        total: 0,
        breakdown: { system: 0, history: 0, input: 0 },
      };
    }
    get liveEstimate() {
      return { system: 0, history: 0, input: 0, total: 0 };
    }
  },
  useNewSmart: jest.fn((SmartClass, ...args) => {
    const instance = new SmartClass(...args);
    const MockProvider = ({ children }) => children;
    return [instance, MockProvider];
  }),
  useSmart: jest.fn((factory, _deps) => {
    const instance = new factory();
    return instance;
  }),
}));

describe("useChatStateSmart", () => {
  let mockDocsBundle: DocsBundle;
  let mockAvailableElements: AvailableElements;

  beforeEach(() => {
    mockDocsBundle = {
      runnerAiMd: "Test runner docs",
      graphqlSdl: "type Query { hello: String }",
      runnerDevMd: "Test runner dev docs",
      projectOverviewMd: "# Test Project",
    };

    mockAvailableElements = {
      tasks: [{ id: "task-1", name: "Test Task" }],
      resources: [{ id: "res-1", name: "Test Resource" }],
      events: [{ id: "event-1", name: "Test Event" }],
      hooks: [{ id: "hook-1", name: "Test Hook" }],
      middlewares: [{ id: "mid-1", name: "Test Middleware" }],
      tags: [{ id: "tag-1", name: "Test Tag" }],
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Hook Functionality", () => {
    test("should provide chat state and methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(result.current.chatState).toBeDefined();
      expect(result.current.chatState.messages).toHaveLength(1);
      expect(result.current.chatState.messages[0].author).toBe("bot");
      expect(result.current.sendMessage).toBeDefined();
      expect(result.current.updateSettings).toBeDefined();
      expect(result.current.clearChat).toBeDefined();
    });

    test("should work without optional parameters", () => {
      const { result } = renderHook(() => useChatStateSmart());

      expect(result.current.chatState).toBeDefined();
      expect(result.current.sendMessage).toBeDefined();
    });
  });

  describe("Method Availability", () => {
    test("should provide all messaging methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(typeof result.current.sendMessage).toBe("function");
      expect(typeof result.current.sendMessageWithText).toBe("function");
      expect(typeof result.current.retryLastResponse).toBe("function");
      expect(typeof result.current.stopRequest).toBe("function");
      expect(typeof result.current.clearChat).toBe("function");
    });

    test("should provide all settings methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(typeof result.current.updateSettings).toBe("function");
      expect(typeof result.current.testOpenAIConnection).toBe("function");
    });

    test("should provide all context methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(typeof result.current.updateChatContext).toBe("function");
      expect(typeof result.current.updateStickyDocs).toBe("function");
    });

    test("should provide all UI state methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(typeof result.current.setInputValue).toBe("function");
      expect(typeof result.current.setSearchQuery).toBe("function");
      expect(typeof result.current.setSelectedMessageId).toBe("function");
    });

    test("should provide Deep Implementation methods", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(typeof result.current.enableDeepImplementation).toBe("function");
      expect(typeof result.current.setDeepImplAnswers).toBe("function");
      expect(typeof result.current.continueDeepImplFlow).toBe("function");
    });
  });

  describe("Computed Properties", () => {
    test("should provide computed properties", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      expect(result.current.canRetry).toBeDefined();
      expect(typeof result.current.canRetry).toBe("boolean");

      expect(result.current.tokenStatus).toBeDefined();
      expect(result.current.tokenStatus).toHaveProperty("mode");
      expect(result.current.tokenStatus).toHaveProperty("total");
      expect(result.current.tokenStatus).toHaveProperty("breakdown");

      expect(result.current.liveEstimate).toBeDefined();
      expect(result.current.liveEstimate).toHaveProperty("system");
      expect(result.current.liveEstimate).toHaveProperty("history");
      expect(result.current.liveEstimate).toHaveProperty("input");
      expect(result.current.liveEstimate).toHaveProperty("total");
    });
  });

  describe("Method Binding", () => {
    test("should bind methods correctly", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      const mockInstance =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@bluelibs/smart").useNewSmart.mock.results[0].value[0];

      act(() => {
        result.current.sendMessage("test");
      });

      expect(mockInstance.sendMessage).toHaveBeenCalledWith("test");

      act(() => {
        result.current.updateSettings({ model: "gpt-4" });
      });

      expect(mockInstance.updateSettings).toHaveBeenCalledWith({
        model: "gpt-4",
      });
    });
  });

  describe("Dependency Management", () => {
    test("should recreate Smart instance when docs change", () => {
      const { rerender, result: _result } = renderHook(
        ({ docs, availableElements }) =>
          useChatStateSmart({
            availableElements,
            docs,
          }),
        {
          initialProps: {
            docs: mockDocsBundle,
            availableElements: mockAvailableElements,
          },
        }
      );

      const firstInstance =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@bluelibs/smart").useNewSmart.mock.results[0].value[0];

      rerender({
        docs: { ...mockDocsBundle, runnerAiMd: "Updated docs" },
        availableElements: mockAvailableElements,
      });

      const secondInstance =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@bluelibs/smart").useNewSmart.mock.results[1].value[0];

      expect(firstInstance).not.toBe(secondInstance);
    });

    test("should recreate Smart instance when availableElements change", () => {
      const { rerender } = renderHook(
        ({ docs, availableElements }) =>
          useChatStateSmart({
            availableElements,
            docs,
          }),
        {
          initialProps: {
            docs: mockDocsBundle,
            availableElements: mockAvailableElements,
          },
        }
      );

      const firstInstance =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@bluelibs/smart").useNewSmart.mock.results[0].value[0];

      rerender({
        docs: mockDocsBundle,
        availableElements: {
          ...mockAvailableElements,
          tasks: [
            ...mockAvailableElements.tasks,
            { id: "task-2", name: "New Task" },
          ],
        },
      });

      const secondInstance =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("@bluelibs/smart").useNewSmart.mock.results[1].value[0];

      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe("State Updates", () => {
    test("should update computed properties when state changes", () => {
      const { result, rerender } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      // Force a rerender to test computed properties
      rerender();

      expect(result.current.chatState).toBeDefined();
      expect(result.current.tokenStatus).toBeDefined();
      expect(result.current.liveEstimate).toBeDefined();
    });
  });

  describe("API Compatibility", () => {
    test("should provide same API as useChatState", () => {
      const { result } = renderHook(() =>
        useChatStateSmart({
          availableElements: mockAvailableElements,
          docs: mockDocsBundle,
        })
      );

      // These are the key properties and methods that useChatState provides
      const expectedApi = [
        "chatState",
        "sendMessage",
        "sendMessageWithText",
        "clearChat",
        "updateSettings",
        "testOpenAIConnection",
        "stopRequest",
        "retryLastResponse",
        "updateChatContext",
        "updateStickyDocs",
        "setInputValue",
        "setSearchQuery",
        "setSelectedMessageId",
        "enableDeepImplementation",
        "setDeepImplAnswers",
        "continueDeepImplFlow",
        "canRetry",
        "tokenStatus",
        "liveEstimate",
      ];

      expectedApi.forEach((property) => {
        expect(result.current).toHaveProperty(property);
      });
    });
  });
});
