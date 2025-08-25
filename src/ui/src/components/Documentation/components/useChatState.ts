import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ChatState,
  ChatMessage,
  TextMessage,
  FileMessage,
  DiffMessage,
  ChatSettings,
} from "./ChatTypes";
import {
  generateUnifiedDiff,
  saveChatHistory,
  loadChatHistory,
  saveChatSettings,
  loadChatSettings,
  computeContextEstimateFromContext,
  DocsBundle,
  buildRequestMessages,
  expandDocsInMessage,
  DocsIncludeFlags,
} from "./ChatUtils";
import {
  streamChatCompletion,
  createToolCallAccumulator,
  buildOpenAiTools,
  RegisteredTool,
  AiMessage,
} from "./ai.service";
import { fetchElementFileContentsBySearch } from "../utils/fileContentUtils";
import { graphqlRequest } from "../utils/graphqlClient";
import { SYSTEM_PROMPT } from "./ai.systemPrompt";

const defaultSettings: ChatSettings = {
  openaiApiKey: null,
  model: "gpt-4o-mini",
  stream: true,
  responseMode: "text",
  baseUrl: "https://api.openai.com",
  enableShortcuts: true,
  showTokenMeter: true,
  virtualizeMessages: false,
};

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
  settings: defaultSettings,
  canStop: false,
  lastUsage: null,
  chatContext: {
    include: {
      runner: false,
      runnerDev: false,
      schema: false,
      projectOverview: false,
    },
  },
};

type AvailableElements = {
  tasks: Array<{ id: string; name: string }>;
  resources: Array<{ id: string; name: string }>;
  events: Array<{ id: string; name: string }>;
  hooks: Array<{ id: string; name: string }>;
  middlewares: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
};

export const useChatState = (opts?: {
  availableElements?: AvailableElements;
  docs?: DocsBundle;
}) => {
  const [chatState, setChatState] = useState<ChatState>(initialChatState);
  const pendingBotTimeout = useRef<number | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Load persisted chat history and settings on mount
  useEffect(() => {
    const savedMessages = loadChatHistory();
    if (savedMessages && savedMessages.length > 0) {
      setChatState((prev) => ({ ...prev, messages: savedMessages }));
    }
    const savedSettings = loadChatSettings();
    if (savedSettings) {
      setChatState((prev) => ({
        ...prev,
        settings: { ...defaultSettings, ...savedSettings },
      }));
    }
  }, []);

  // Persist chat history
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveChatHistory(chatState.messages);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chatState.messages]);

  // Cleanup timeouts and abort controllers
  useEffect(() => {
    return () => {
      if (pendingBotTimeout.current) {
        window.clearTimeout(pendingBotTimeout.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<ChatSettings>) => {
    setChatState((prev) => {
      const next = { ...prev, settings: { ...prev.settings, ...partial } };
      saveChatSettings(next.settings);
      return next;
    });
  }, []);

  const addErrorMessage = useCallback((errorMessage: string) => {
    const errorResponse: TextMessage = {
      id: `error-${Date.now()}`,
      author: "bot",
      type: "text",
      text: errorMessage,
      timestamp: Date.now(),
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, errorResponse],
      isTyping: false,
      thinkingStage: "none",
      canStop: false,
    }));
  }, []);

  const sendToOpenAI = useCallback(
    async (userMessage: string, overrideInclude?: DocsIncludeFlags) => {
      const { settings } = chatState;
      if (!settings.openaiApiKey) {
        addErrorMessage(
          "❌ OpenAI API key is required. Please configure it in the settings to use the AI assistant."
        );
        return;
      }

      // Create abort controller for this request
      abortController.current = new AbortController();

      // Prepare assistant placeholder message for streaming
      const assistantMessageId = `b-${Date.now()}`;
      setChatState((prev) => ({
        ...prev,
        isTyping: true,
        thinkingStage: "thinking",
        toolCalls: [],
        canStop: true,
        messages: [
          ...prev.messages,
          {
            id: assistantMessageId,
            author: "bot",
            type: "text",
            text: "",
            timestamp: Date.now(),
          } as TextMessage,
        ],
      }));

      let accumulated = "";
      let usageTotals = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // Build minimal chat history (only text messages)
      const prior = chatState.messages
        .filter((m) => m.type === "text")
        .map((m) => ({
          role: m.author === "user" ? "user" : "assistant",
          content: (m as TextMessage).text || "",
        })) as AiMessage[];

      // Helper to resolve element ID from name via availableElements
      const resolveId = (
        type: "task" | "resource" | "event" | "hook" | "middleware" | "tag",
        idOrName?: { id?: string; name?: string }
      ): string | undefined => {
        if (idOrName?.id) return idOrName.id;
        const a = opts?.availableElements;
        if (!a || !idOrName?.name) return undefined;
        const map: Record<string, keyof AvailableElements> = {
          task: "tasks",
          resource: "resources",
          event: "events",
          hook: "hooks",
          middleware: "middlewares",
          tag: "tags",
        };
        const list = a[map[type]];
        const found = list?.find(
          (e) => e.name === idOrName.name || e.id === idOrName.name
        );
        return found?.id;
      };

      // Sample decoupled tool registry (UI-only safe tools)
      const tools: RegisteredTool[] = [
        {
          name: "get_current_time",
          description: "Returns the current ISO timestamp.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          run: async () => ({ now: new Date().toISOString() }),
        },
        {
          name: "get_file_contents_by_element_ids",
          description:
            "Fetch file contents for multiple elements using an array of element ids. Uses universal search to find elements reliably. Returns array in the same order.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
          run: async (args: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = args as { items: string[] };

            const sanitize = (s: string) =>
              s.startsWith("@") ? s.slice(1) : s;

            const fetchBySearch = async (
              raw: string
            ): Promise<{
              id: string;
              filePath: string | null;
              fileContents: string | null;
            } | null> => {
              const elementId = sanitize(raw);

              // Use universal search - much more reliable!
              const result = await fetchElementFileContentsBySearch(elementId);
              return result;
            };

            const results = await Promise.all(
              a.items.map((s) => fetchBySearch(s))
            );
            return results.map(
              (r, idx) =>
                r ?? { id: a.items[idx], filePath: null, fileContents: null }
            );
          },
        },
        {
          name: "graphql_query",
          description: [
            "Execute a GraphQL query against the app's /graphql endpoint.",
          ].join("\n"),
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
              variables: {
                oneOf: [{ type: "string" }, { type: "object" }],
              },
              operationName: { type: "string" },
              maxItems: { type: "integer", minimum: 1, maximum: 100 },
              title: { type: "string" },
            },
            required: ["query"],
            additionalProperties: false,
          },
          run: async (rawArgs: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const args = (rawArgs || {}) as {
              query: string;
              variables?: unknown;
              operationName?: string;
              format?: "json" | "markdown";
              markdownStyle?: "summary" | "story";
              maxItems?: number;
              title?: string;
            };

            if (!args.query || typeof args.query !== "string") {
              return { error: "Missing 'query' string" };
            }

            let variables: Record<string, unknown> | undefined = undefined;
            if (typeof args.variables === "string") {
              try {
                variables = JSON.parse(args.variables) as Record<
                  string,
                  unknown
                >;
              } catch {
                return { error: "Invalid JSON in 'variables'" };
              }
            } else if (
              args.variables &&
              typeof args.variables === "object" &&
              !Array.isArray(args.variables)
            ) {
              variables = args.variables as Record<string, unknown>;
            }

            const data = await graphqlRequest<unknown>(args.query, variables);

            return { data };
          },
        },
      ];
      const openAiTools = buildOpenAiTools(tools);
      const accumulator = createToolCallAccumulator();

      try {
        const docsBundle = {
          runnerAiMd: opts?.docs?.runnerAiMd || null,
          graphqlSdl: opts?.docs?.graphqlSdl || null,
          runnerDevMd: opts?.docs?.runnerDevMd || null,
          projectOverviewMd: opts?.docs?.projectOverviewMd || null,
        } as DocsBundle;

        const docsTokenRegex =
          /@docs\.(runner|schema|runnerDev|projectOverview)\b/;
        const hasDocsTokens = docsTokenRegex.test(userMessage);
        if (hasDocsTokens) {
          // eslint-disable-next-line no-console
          console.log(
            "[chat] @docs tokens detected in input, include flags:",
            chatState.chatContext?.include || {}
          );
        }

        const expanded = expandDocsInMessage(userMessage, docsBundle);
        if (hasDocsTokens) {
          // eslint-disable-next-line no-console
          console.log("[chat] expandDocsInMessage applied:", {
            originalLength: userMessage.length,
            expandedLength: expanded.modelText.length,
          });
        }

        const firstMessages = buildRequestMessages(
          SYSTEM_PROMPT,
          overrideInclude ?? (chatState.chatContext?.include || {}),
          prior,
          expanded.modelText,
          docsBundle
        );
        await streamChatCompletion(
          {
            settings,
            messages: firstMessages,
            tools: openAiTools,
            tool_choice: "auto",
            temperature: 0.2,
            response_format:
              settings.responseMode === "json"
                ? { type: "json_object" }
                : undefined,
            signal: abortController.current?.signal!,
          },
          {
            onTextDelta: (delta: any) => {
              accumulated += delta;
              setChatState((prev) => ({
                ...prev,
                thinkingStage: "generating",
                messages: prev.messages.map((m) =>
                  m.id === assistantMessageId
                    ? ({
                        ...(m as TextMessage),
                        text: accumulated,
                      } as TextMessage)
                    : m
                ),
              }));
            },
            onToolCallDelta: (delta: any) => {
              accumulator.accept(delta);
              // reflect live tool-call info in UI
              setChatState((prev) => {
                const existing = prev.toolCalls || [];
                const idx = delta.index;
                const prevItem = existing[idx];
                const name = delta.function?.name || prevItem?.name;
                const nextArgs =
                  (prevItem?.argsPreview || "") +
                  (delta.function?.arguments || "");
                const updated = existing.slice();
                updated[idx] = {
                  id: delta.id || prevItem?.id || String(idx),
                  name,
                  argsPreview:
                    nextArgs.length > 120
                      ? nextArgs.slice(0, 117) + "..."
                      : nextArgs,
                  status: "running",
                };
                return {
                  ...prev,
                  thinkingStage: "processing",
                  toolCalls: updated,
                };
              });
            },
            onUsage: (usage: any) => {
              usageTotals = {
                promptTokens:
                  usageTotals.promptTokens + (usage.prompt_tokens || 0),
                completionTokens:
                  usageTotals.completionTokens + (usage.completion_tokens || 0),
                totalTokens:
                  usageTotals.totalTokens + (usage.total_tokens || 0),
              };
              setChatState((prev) => ({
                ...prev,
                lastUsage: { ...usageTotals },
              }));
            },
            onFinish: async (_final: any, _finishReason: any) => {
              // If tools requested, execute them and do a follow-up turn
              const toolCalls = accumulator.list();
              if (toolCalls.length > 0) {
                try {
                  const assistantToolMsg: AiMessage = {
                    role: "assistant",
                    tool_calls: toolCalls.map((c: any, i: number) => ({
                      id: c.id || `call_${i}`,
                      type: "function",
                      function: { name: c.name, arguments: c.argsText },
                    })),
                  };

                  // Ensure UI shows planned tool calls even if no deltas were streamed
                  setChatState((prev) => ({
                    ...prev,
                    thinkingStage: "processing",
                    toolCalls: toolCalls.map((c, i) => ({
                      id: c.id || String(i),
                      name: c.name,
                      argsPreview:
                        (c.argsText || "").length > 120
                          ? c.argsText.slice(0, 117) + "..."
                          : c.argsText || "",
                      status: "pending",
                    })),
                  }));

                  const toolResults: AiMessage[] = [];
                  for (let i = 0; i < toolCalls.length; i++) {
                    const c = toolCalls[i];
                    const tool = tools.find((t) => t.name === c.name);
                    if (!tool) continue;
                    let argsObj: unknown = {};
                    try {
                      argsObj = c.argsText ? JSON.parse(c.argsText) : {};
                    } catch {}
                    // mark this call as running
                    setChatState((prev) => ({
                      ...prev,
                      toolCalls: (prev.toolCalls || []).map((t, idx) =>
                        idx === i ? { ...t, status: "running" } : t
                      ),
                    }));
                    const result = await tool.run(argsObj);
                    // show a small preview of the result
                    setChatState((prev) => ({
                      ...prev,
                      toolCalls: (prev.toolCalls || []).map((t, idx) =>
                        idx === i
                          ? {
                              ...t,
                              status: "done",
                              resultPreview: JSON.stringify(result).slice(
                                0,
                                200
                              ),
                            }
                          : t
                      ),
                    }));
                    toolResults.push({
                      role: "tool",
                      content: JSON.stringify(result),
                      tool_call_id: c.id,
                      name: c.name,
                    });
                  }

                  // If the first streamed message is empty (tool-only turn), remove it to avoid empty bubble
                  const assistantMessageId2 = `b-${Date.now()}-2`;
                  setChatState((prev) => {
                    const keep = prev.messages.filter((m) => {
                      if (m.id !== assistantMessageId) return true;
                      const txt = (m as TextMessage).text || "";
                      return txt.trim().length > 0;
                    });
                    return {
                      ...prev,
                      messages: [
                        ...keep,
                        {
                          id: assistantMessageId2,
                          author: "bot",
                          type: "text",
                          text: "",
                          timestamp: Date.now(),
                        } as TextMessage,
                      ],
                    };
                  });

                  let secondAccumulated = "";
                  const secondMessages = [
                    ...buildRequestMessages(
                      SYSTEM_PROMPT,
                      overrideInclude ?? (chatState.chatContext?.include || {}),
                      prior,
                      expanded.modelText,
                      docsBundle
                    ),
                    assistantToolMsg,
                    ...toolResults,
                  ];
                  await streamChatCompletion(
                    {
                      settings,
                      messages: secondMessages,
                      temperature: 0.2,
                      response_format:
                        settings.responseMode === "json"
                          ? { type: "json_object" }
                          : undefined,
                      signal: abortController.current?.signal!,
                    },
                    {
                      onTextDelta: (d2: any) => {
                        secondAccumulated += d2;
                        setChatState((prev) => ({
                          ...prev,
                          messages: prev.messages.map((m) =>
                            m.id === assistantMessageId2
                              ? ({
                                  ...(m as TextMessage),
                                  text: secondAccumulated,
                                } as TextMessage)
                              : m
                          ),
                        }));
                      },
                      onUsage: (usage: any) => {
                        usageTotals = {
                          promptTokens:
                            usageTotals.promptTokens +
                            (usage.prompt_tokens || 0),
                          completionTokens:
                            usageTotals.completionTokens +
                            (usage.completion_tokens || 0),
                          totalTokens:
                            usageTotals.totalTokens + (usage.total_tokens || 0),
                        };
                        setChatState((prev) => ({
                          ...prev,
                          lastUsage: { ...usageTotals },
                        }));
                      },
                      onFinish: () => {
                        // Attach tool calls summary to the last assistant text message
                        setChatState((prev) => {
                          const calls = prev.toolCalls || [];
                          if (!calls.length) return prev;
                          let lastBotIndex: number | undefined = undefined;
                          for (let i = prev.messages.length - 1; i >= 0; i--) {
                            const mm = prev.messages[i];
                            if (mm.author === "bot" && mm.type === "text") {
                              lastBotIndex = i;
                              break;
                            }
                          }
                          if (lastBotIndex === undefined) return prev;
                          const nextMessages = prev.messages.slice();
                          const existing = nextMessages[
                            lastBotIndex
                          ] as TextMessage;
                          nextMessages[lastBotIndex] = {
                            ...(existing as TextMessage),
                            toolCalls: calls.map((t) => ({
                              id: t.id,
                              name: t.name,
                              argsPreview: t.argsPreview,
                              resultPreview: t.resultPreview,
                            })),
                          } as TextMessage;
                          return { ...prev, messages: nextMessages };
                        });
                      },
                      onError: (e: any) => {
                        throw e;
                      },
                    }
                  );
                } catch (e) {
                  // if tool execution failed, append an error line
                  const extra = `❌ Tool execution failed: ${String(e)}`;
                  const sep = accumulated.endsWith("\n") ? "" : "\n\n";
                  const withError = accumulated + sep + extra;
                  setChatState((prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === assistantMessageId
                        ? ({
                            ...(m as TextMessage),
                            text: withError,
                          } as TextMessage)
                        : m
                    ),
                    toolCalls: (prev.toolCalls || []).map((t) =>
                      t.status === "running" || t.status === "pending"
                        ? { ...t, status: "error" }
                        : t
                    ),
                  }));
                }
              }
            },
            onError: (e: any) => {
              throw e;
            },
          }
        );

        // Finalize
        setChatState((prev) => ({
          ...prev,
          isTyping: false,
          thinkingStage: "none",
          toolCalls: [],
          canStop: false,
        }));
      } catch (err: any) {
        // Check if request was aborted
        if (err.name === "AbortError") {
          setChatState((prev) => ({
            ...prev,
            isTyping: false,
            thinkingStage: "none",
            toolCalls: [],
            canStop: false,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId
                ? ({
                    ...(m as TextMessage),
                    text: "❌ Request stopped by user",
                  } as TextMessage)
                : m
            ),
          }));
        } else {
          setChatState((prev) => ({
            ...prev,
            isTyping: false,
            thinkingStage: "none",
            toolCalls: [],
            canStop: false,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId
                ? ({
                    ...(m as TextMessage),
                    text: `❌ Error: ${
                      err?.message || "Failed to contact OpenAI"
                    }`,
                  } as TextMessage)
                : m
            ),
          }));
        }
      }
    },
    [chatState, addErrorMessage]
  );

  const sendMessage = useCallback(() => {
    const trimmed = chatState.inputValue.trim();
    if (!trimmed) return;

    // Capture preflight estimate before state/input changes
    try {
      const historyStrings = (
        chatState.messages.filter((m) => m.type === "text") as TextMessage[]
      ).map((m) => m.text || "");
      const est = computeContextEstimateFromContext(
        SYSTEM_PROMPT,
        historyStrings,
        chatState.inputValue || "",
        {
          runnerAiMd: opts?.docs?.runnerAiMd || null,
          graphqlSdl: opts?.docs?.graphqlSdl || null,
          runnerDevMd: opts?.docs?.runnerDevMd || null,
          projectOverviewMd: opts?.docs?.projectOverviewMd || null,
        },
        chatState.chatContext?.include || {}
      );
      setChatState((prev) => ({
        ...prev,
        preflightContext: {
          system: est.system,
          history: est.history,
          input: est.input,
          tokens: est.total,
        },
      }));
    } catch {}

    const userMsg: TextMessage = {
      id: `m-${Date.now()}`,
      author: "user",
      type: "text",
      text: trimmed,
      timestamp: Date.now(),
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      inputValue: "",
    }));

    // Always try OpenAI - will show error if no key
    void sendToOpenAI(trimmed);
  }, [chatState.inputValue, sendToOpenAI]);

  // Send message with custom text (for context injection)
  const sendMessageWithText = useCallback(
    (
      messageText: string,
      displayText?: string,
      overrideInclude?: DocsIncludeFlags
    ) => {
      if (!messageText.trim()) return;

      // Capture preflight estimate based on current input box
      try {
        const historyStrings = (
          chatState.messages.filter((m) => m.type === "text") as TextMessage[]
        ).map((m) => m.text || "");
        const est = computeContextEstimateFromContext(
          SYSTEM_PROMPT,
          historyStrings,
          chatState.inputValue || "",
          {
            runnerAiMd: opts?.docs?.runnerAiMd || null,
            graphqlSdl: opts?.docs?.graphqlSdl || null,
            runnerDevMd: opts?.docs?.runnerDevMd || null,
            projectOverviewMd: opts?.docs?.projectOverviewMd || null,
          },
          chatState.chatContext?.include || {}
        );
        setChatState((prev) => ({
          ...prev,
          preflightContext: {
            system: est.system,
            history: est.history,
            input: est.input,
            tokens: est.total,
          },
        }));
      } catch {}

      // Use displayText for the UI message
      const userMsg: TextMessage = {
        id: `m-${Date.now()}`,
        author: "user",
        type: "text",
        text: displayText || messageText.trim(),
        timestamp: Date.now(),
      };

      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        inputValue: "",
      }));

      // Send the full context message to OpenAI
      void sendToOpenAI(messageText.trim(), overrideInclude);
    },
    [sendToOpenAI, chatState.messages, chatState.inputValue, opts?.docs]
  );

  const testOpenAIConnection = useCallback(
    async (
      overrideKey?: string,
      overrideBaseUrl?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const key = overrideKey ?? chatState.settings.openaiApiKey;
      if (!key) return { ok: false, error: "Missing API key" };
      try {
        const base = (
          overrideBaseUrl ??
          chatState.settings.baseUrl ??
          "https://api.openai.com"
        ).replace(/\/$/, "");
        const url = `${base}/v1/chat/completions`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: chatState.settings.model,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            stream: false,
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          return { ok: false, error: t || `HTTP ${resp.status}` };
        }
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message || "Network error" };
      }
    },
    [
      chatState.settings.model,
      chatState.settings.openaiApiKey,
      chatState.settings.baseUrl,
    ]
  );

  const stopRequest = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
    if (pendingBotTimeout.current) {
      window.clearTimeout(pendingBotTimeout.current);
      pendingBotTimeout.current = null;
    }
  }, []);

  const clearChat = useCallback(() => {
    localStorage.removeItem("chat-sidebar-history");
    setChatState((prev) => ({
      ...prev,
      inputValue: "",
      messages: [
        {
          id: "welcome",
          author: "bot",
          type: "text",
          text: "Chat history cleared. How can I help you?",
          timestamp: Date.now(),
        } as TextMessage,
      ],
      canStop: false,
      // Zero out context flags and usage when clearing chat
      chatContext: {
        include: {
          runner: false,
          runnerDev: false,
          schema: false,
          projectOverview: false,
        },
      },
      lastUsage: null,
      preflightContext: null,
    }));
  }, []);

  const retryLastResponse = useCallback(() => {
    // Find the last user message
    const messages = chatState.messages;
    const lastUserMessageIndex = messages
      .map((m) => m.author)
      .lastIndexOf("user");

    if (lastUserMessageIndex === -1) return; // No user message found

    const lastUserMessage = messages[lastUserMessageIndex] as TextMessage;

    // Remove all messages after the last user message (typically bot responses)
    const messagesUpToUser = messages.slice(0, lastUserMessageIndex + 1);

    setChatState((prev) => ({
      ...prev,
      messages: messagesUpToUser,
    }));

    // Retry the AI request with the same user message
    void sendToOpenAI(lastUserMessage.text);
  }, [chatState.messages, sendToOpenAI]);

  // Live context estimate based on current input and messages (single source of truth)
  // Input used for estimates is just the live input (docs are carried in history)
  const inputForEstimate = useMemo(
    () => chatState.inputValue || "",
    [chatState.inputValue]
  );

  const historyForEstimate: string[] = (
    chatState.messages
      .filter((m) => m.type === "text")
      // Exclude the special welcome/clear informational message from estimates
      .filter((m) => m.id !== "welcome") as TextMessage[]
  ).map((m) => (m as TextMessage).text || "");

  const liveEstimate = computeContextEstimateFromContext(
    SYSTEM_PROMPT,
    historyForEstimate,
    chatState.inputValue || "",
    {
      runnerAiMd: opts?.docs?.runnerAiMd || null,
      graphqlSdl: opts?.docs?.graphqlSdl || null,
      runnerDevMd: opts?.docs?.runnerDevMd || null,
      projectOverviewMd: opts?.docs?.projectOverviewMd || null,
    },
    chatState.chatContext?.include || {}
  );

  const tokenStatus = (() => {
    const hasInput = (chatState.inputValue || "").trim().length > 0;
    const hasIncludes = Boolean(
      chatState.chatContext?.include?.runner ||
        chatState.chatContext?.include?.runnerDev ||
        chatState.chatContext?.include?.schema ||
        chatState.chatContext?.include?.projectOverview
    );
    const hasHistory = historyForEstimate.length > 0;

    // When there's no history (besides the welcome message), no input, and no sticky includes,
    // show a fully reset counter instead of counting system tokens.
    if (!hasHistory && !hasInput && !hasIncludes && !chatState.isTyping) {
      return {
        mode: "context" as const,
        total: 0,
        breakdown: { system: 0, history: 0, input: 0 },
      };
    }

    // While streaming, always show the stable preflight context (no mid-stream bounce)
    if (chatState.isTyping) {
      const pf = chatState.preflightContext;
      return {
        mode: "context" as const,
        total: pf?.tokens ?? liveEstimate.total,
        breakdown: pf
          ? { system: pf.system, history: pf.history, input: pf.input }
          : {
              system: liveEstimate.system,
              history: liveEstimate.history,
              input: liveEstimate.input,
            },
      };
    }

    // Not streaming: if there's input, show live context; otherwise show last usage if available
    if (hasInput || !chatState.lastUsage) {
      return {
        mode: "context" as const,
        total: liveEstimate.total,
        breakdown: {
          system: liveEstimate.system,
          history: liveEstimate.history,
          input: liveEstimate.input,
        },
      };
    }

    return {
      mode: "usage" as const,
      total: chatState.lastUsage?.totalTokens ?? 0,
      breakdown: { system: 0, history: 0, input: 0 },
    };
  })();

  return {
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
  };
};
