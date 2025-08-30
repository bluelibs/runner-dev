import { useRef, useCallback } from "react";
import { SYSTEM_PROMPT } from "../ai.systemPrompt";
import {
  streamChatCompletion,
  createToolCallAccumulator,
  buildOpenAiTools,
  RegisteredTool,
} from "../ai.service";
import {
  buildRequestMessages,
  expandDocsInMessage,
  DocsIncludeFlags,
  DocsBundle,
} from "../ChatUtils";
import { createTools } from "../ai.tools";
import { ChatState, TextMessage, AiMessage } from "../ChatTypes";

type UseOpenAIResponderParams = {
  getChatState: () => ChatState;
  setChatState: React.Dispatch<React.SetStateAction<ChatState>>;
  getDocsBundle?: () => DocsBundle;
};

export const useOpenAIResponder = (params: UseOpenAIResponderParams) => {
  const abortController = useRef<AbortController | null>(null);

  const stopRequest = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  }, []);

  const sendToOpenAI = useCallback(
    async (userMessage: string, overrideInclude?: DocsIncludeFlags) => {
      const chatState = params.getChatState();
      const { settings } = chatState;
      if (!settings.openaiApiKey) {
        const errorResponse: TextMessage = {
          id: `error-${Date.now()}`,
          author: "bot",
          type: "text",
          text:
            "❌ OpenAI API key is required. Please configure it in the settings to use the AI assistant.",
          timestamp: Date.now(),
        };
        params.setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorResponse],
          isTyping: false,
          thinkingStage: "none",
          canStop: false,
        }));
        return;
      }

      abortController.current = new AbortController();

      const assistantMessageId = `b-${Date.now()}`;
      params.setChatState((prev) => ({
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

      const prior = params
        .getChatState()
        .messages.filter((m) => m.type === "text")
        .map((m) => ({
          role: m.author === "user" ? "user" : "assistant",
          content: (m as TextMessage).text || "",
        })) as AiMessage[];

      const docsBundle: DocsBundle = params.getDocsBundle
        ? params.getDocsBundle()
        : {
            runnerAiMd: null,
            graphqlSdl: null,
            runnerDevMd: null,
            projectOverviewMd: null,
          };

      const docsTokenRegex = /@docs\.(runner|schema|runnerDev|projectOverview)\b/;
      const hasDocsTokens = docsTokenRegex.test(userMessage);
      if (hasDocsTokens) {
        // eslint-disable-next-line no-console
        console.log(
          "[chat] @docs tokens detected in input, include flags:",
          params.getChatState().chatContext?.include || {}
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

      const tools: RegisteredTool[] = [
        ...createTools(params.getChatState, params.setChatState),
      ];
      const openAiTools = buildOpenAiTools(tools);
      const accumulator = createToolCallAccumulator();

      try {
        const firstMessages = buildRequestMessages(
          SYSTEM_PROMPT,
          overrideInclude ?? (params.getChatState().chatContext?.include || {}),
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
            response_format:
              settings.responseMode === "json"
                ? { type: "json_object" }
                : undefined,
            signal: abortController.current?.signal!,
          },
          {
            onTextDelta: (delta: any) => {
              accumulated += delta;
              params.setChatState((prev) => ({
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
              params.setChatState((prev) => {
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
                  argsPreview: nextArgs,
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
                promptTokens: usageTotals.promptTokens + (usage.prompt_tokens || 0),
                completionTokens:
                  usageTotals.completionTokens + (usage.completion_tokens || 0),
                totalTokens: usageTotals.totalTokens + (usage.total_tokens || 0),
              };
              params.setChatState((prev) => ({
                ...prev,
                lastUsage: { ...usageTotals },
                deepImpl: {
                  ...(prev.deepImpl || {}),
                  budget: {
                    ...((prev.deepImpl && (prev.deepImpl as any).budget) || {}),
                    usedApprox: usageTotals.totalTokens,
                  },
                },
              }));
            },
            onFinish: async (_final: any, _finishReason: any) => {
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

                  params.setChatState((prev) => ({
                    ...prev,
                    thinkingStage: "processing",
                    toolCalls: toolCalls.map((c, i) => ({
                      id: c.id || String(i),
                      name: c.name,
                      argsPreview: c.argsText || "",
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
                    params.setChatState((prev) => ({
                      ...prev,
                      toolCalls: (prev.toolCalls || []).map((t, idx) =>
                        idx === i ? { ...t, status: "running" } : t
                      ),
                    }));
                    const result = await tool.run(argsObj);
                    params.setChatState((prev) => ({
                      ...prev,
                      toolCalls: (prev.toolCalls || []).map((t, idx) =>
                        idx === i
                          ? {
                              ...t,
                              status: "done",
                              resultPreview: JSON.stringify(result).slice(0, 200),
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

                  const assistantMessageId2 = `b-${Date.now()}-2`;
                  params.setChatState((prev) => {
                    const txt = (
                      prev.messages.find((m) => m.id === assistantMessageId) as
                        | TextMessage
                        | undefined
                    )?.text || "";
                    const keep =
                      txt.trim().length > 0
                        ? prev.messages
                        : prev.messages.filter((m) => m.id !== assistantMessageId);
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
                          toolCalls: (prev.toolCalls || []).map((t) => ({
                            id: t.id,
                            name: t.name,
                            argsPreview: t.argsPreview,
                            resultPreview: t.resultPreview,
                          })),
                        } as TextMessage,
                      ],
                    };
                  });

                  let secondAccumulated = "";
                  const secondMessages = [
                    ...buildRequestMessages(
                      SYSTEM_PROMPT,
                      overrideInclude ??
                        (params.getChatState().chatContext?.include || {}),
                      prior,
                      expanded.modelText,
                      docsBundle
                    ),
                    assistantToolMsg,
                    ...toolResults,
                  ];
                  const secondAccumulator = createToolCallAccumulator();
                  await streamChatCompletion(
                    {
                      settings,
                      messages: secondMessages,
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
                      onTextDelta: (d2: any) => {
                        secondAccumulated += d2;
                        params.setChatState((prev) => ({
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
                      onToolCallDelta: (delta2: any) => {
                        secondAccumulator.accept(delta2);
                        params.setChatState((prev) => {
                          const existing = prev.toolCalls || [];
                          const idx = delta2.index;
                          const prevItem = existing[idx];
                          const name = delta2.function?.name || prevItem?.name;
                          const nextArgs =
                            (prevItem?.argsPreview || "") +
                            (delta2.function?.arguments || "");
                          const updated = existing.slice();
                          updated[idx] = {
                            id: delta2.id || prevItem?.id || String(idx),
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
                            usageTotals.completionTokens +
                            (usage.completion_tokens || 0),
                          totalTokens:
                            usageTotals.totalTokens + (usage.total_tokens || 0),
                        };
                        params.setChatState((prev) => ({
                          ...prev,
                          lastUsage: { ...usageTotals },
                          deepImpl: {
                            ...(prev.deepImpl || {}),
                            budget: {
                              ...((prev.deepImpl && (prev.deepImpl as any).budget) ||
                                {}),
                              usedApprox: usageTotals.totalTokens,
                            },
                          },
                        }));
                      },
                      onFinish: async () => {
                        params.setChatState((prev) => {
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
                          const existing = nextMessages[lastBotIndex] as TextMessage;
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

                        const toolCalls2 = secondAccumulator.list();
                        if (toolCalls2.length > 0) {
                          try {
                            const assistantToolMsg2: AiMessage = {
                              role: "assistant",
                              tool_calls: toolCalls2.map((c: any, i: number) => ({
                                id: c.id || `call2_${i}`,
                                type: "function",
                                function: {
                                  name: c.name,
                                  arguments: c.argsText,
                                },
                              })),
                            };

                            params.setChatState((prev) => ({
                              ...prev,
                              thinkingStage: "processing",
                              toolCalls: toolCalls2.map((c: any, i: number) => ({
                                id: c.id || String(i),
                                name: c.name,
                                argsPreview:
                                  (c.argsText || "").length > 120
                                    ? c.argsText.slice(0, 117) + "..."
                                    : c.argsText || "",
                                status: "pending",
                              })),
                            }));

                            const toolResults2: AiMessage[] = [];
                            for (let i = 0; i < toolCalls2.length; i++) {
                              const c = toolCalls2[i];
                              const tool = tools.find((t) => t.name === c.name);
                              if (!tool) continue;
                              let argsObj: unknown = {};
                              try {
                                argsObj = c.argsText ? JSON.parse(c.argsText) : {};
                              } catch {}
                              params.setChatState((prev) => ({
                                ...prev,
                                toolCalls: (prev.toolCalls || []).map((t, idx) =>
                                  idx === i ? { ...t, status: "running" } : t
                                ),
                              }));
                              const result = await tool.run(argsObj);
                              params.setChatState((prev) => ({
                                ...prev,
                                toolCalls: (prev.toolCalls || []).map((t, idx) =>
                                  idx === i
                                    ? {
                                        ...t,
                                        status: "done",
                                        resultPreview: JSON.stringify(
                                          result,
                                          null,
                                          2
                                        ),
                                      }
                                    : t
                                ),
                              }));
                              toolResults2.push({
                                role: "tool",
                                content: JSON.stringify(result),
                                tool_call_id: c.id,
                                name: c.name,
                              });
                            }

                            const assistantMessageId3 = `b-${Date.now()}-3`;
                            params.setChatState((prev) => ({
                              ...prev,
                              messages: [
                                ...prev.messages,
                                {
                                  id: assistantMessageId3,
                                  author: "bot",
                                  type: "text",
                                  text: "",
                                  timestamp: Date.now(),
                                  toolCalls: (prev.toolCalls || []).map((t) => ({
                                    id: t.id,
                                    name: t.name,
                                    argsPreview: t.argsPreview,
                                    resultPreview: t.resultPreview,
                                  })),
                                } as TextMessage,
                              ],
                            }));

                            let thirdAccumulated = "";
                            const thirdMessages = [
                              ...buildRequestMessages(
                                SYSTEM_PROMPT,
                                overrideInclude ??
                                  (params.getChatState().chatContext?.include ||
                                    {}),
                                prior,
                                expanded.modelText,
                                docsBundle
                              ),
                              assistantToolMsg2,
                              ...toolResults2,
                            ];
                            await streamChatCompletion(
                              {
                                settings,
                                messages: thirdMessages,
                                temperature: 0.2,
                                response_format:
                                  settings.responseMode === "json"
                                    ? { type: "json_object" }
                                    : undefined,
                                signal: abortController.current?.signal!,
                              },
                              {
                                onTextDelta: (d3: any) => {
                                  thirdAccumulated += d3;
                                  params.setChatState((prev) => ({
                                    ...prev,
                                    messages: prev.messages.map((m) =>
                                      m.id === assistantMessageId3
                                        ? ({
                                            ...(m as TextMessage),
                                            text: thirdAccumulated,
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
                                      usageTotals.totalTokens +
                                      (usage.total_tokens || 0),
                                  };
                                  params.setChatState((prev) => ({
                                    ...prev,
                                    lastUsage: { ...usageTotals },
                                    deepImpl: {
                                      ...(prev.deepImpl || {}),
                                      budget: {
                                        ...((prev.deepImpl &&
                                          (prev.deepImpl as any).budget) || {}),
                                        usedApprox: usageTotals.totalTokens,
                                      },
                                    },
                                  }));
                                },
                                onFinish: () => {
                                  params.setChatState((prev) => {
                                    const calls = prev.toolCalls || [];
                                    if (!calls.length) return prev;
                                    let lastBotIndex: number | undefined =
                                      undefined;
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

                                  setTimeout(() => {
                                    const state = params.getChatState();
                                    const lastBot = [...state.messages]
                                      .reverse()
                                      .find(
                                        (m) => m.author === "bot" && m.type === "text"
                                      ) as TextMessage | undefined;
                                    const empty = !lastBot || !(lastBot.text || "").trim();
                                    if (empty) {
                                      const retryPrompt =
                                        "Re-evaluate the provided context and produce a concise answer, as the prior step only used tool calls without output.";
                                      void sendToOpenAI(retryPrompt);
                                    }
                                  }, 0);
                                },
                                onError: (e: any) => {
                                  const msg = e?.message || String(e);
                                  params.setChatState((prev) => ({
                                    ...prev,
                                    isTyping: false,
                                    thinkingStage: "none",
                                    canStop: false,
                                    messages: prev.messages.map((m) =>
                                      m.id === assistantMessageId2
                                        ? ({
                                            ...(m as TextMessage),
                                            text:
                                              ((m as TextMessage).text || "") +
                                              (msg ? `\n\n❌ Error: ${msg}` : ""),
                                          } as TextMessage)
                                        : m
                                    ),
                                  }));
                                },
                              }
                            );
                          } catch (e) {
                            const extra = `❌ Tool execution failed: ${String(e)}`;
                            const sep = secondAccumulated.endsWith("\n") ? "" : "\n\n";
                            const withError = secondAccumulated + sep + extra;
                            params.setChatState((prev) => ({
                              ...prev,
                              messages: prev.messages.map((m) =>
                                m.id === assistantMessageId2
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
                        const msg = e?.message || String(e);
                        params.setChatState((prev) => ({
                          ...prev,
                          isTyping: false,
                          thinkingStage: "none",
                          canStop: false,
                          messages: prev.messages.map((m) =>
                            m.id === assistantMessageId2
                              ? ({
                                  ...(m as TextMessage),
                                  text:
                                    ((m as TextMessage).text || "") +
                                    (msg ? `\n\n❌ Error: ${msg}` : ""),
                                } as TextMessage)
                              : m
                          ),
                        }));
                      },
                    }
                  );
                } catch (e) {
                  const extra = `❌ Tool execution failed: ${String(e)}`;
                  const sep = accumulated.endsWith("\n") ? "" : "\n\n";
                  const withError = accumulated + sep + extra;
                  params.setChatState((prev) => ({
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
              const msg = e?.message || String(e);
              params.setChatState((prev) => ({
                ...prev,
                isTyping: false,
                thinkingStage: "none",
                canStop: false,
                messages: prev.messages.map((m) =>
                  m.id === assistantMessageId
                    ? ({
                        ...(m as TextMessage),
                        text:
                          ((m as TextMessage).text || "") +
                          (msg ? `\n\n❌ Error: ${msg}` : ""),
                      } as TextMessage)
                    : m
                ),
              }));
            },
          }
        );

        params.setChatState((prev) => ({
          ...prev,
          isTyping: false,
          thinkingStage: "none",
          canStop: false,
        }));
      } catch (err: any) {
        if (err.name === "AbortError") {
          params.setChatState((prev) => ({
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
          params.setChatState((prev) => ({
            ...prev,
            isTyping: false,
            thinkingStage: "none",
            toolCalls: [],
            canStop: false,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId
                ? ({
                    ...(m as TextMessage),
                    text: `❌ Error: ${err?.message || "Failed to contact OpenAI"}`,
                  } as TextMessage)
                : m
            ),
          }));
        }
      }
    }, [params]
  );

  return { sendToOpenAI, stopRequest };
};


