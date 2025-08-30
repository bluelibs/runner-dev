import { ChatSettings } from "./ChatTypes";
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
  ChatCompletion,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { FunctionParameters } from "openai/resources/shared";

export interface AiMessage {
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  name?: string;
  tool_call_id?: string;
  // For assistant messages that trigger tools
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface AiToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: FunctionParameters;
  };
}

export interface AiToolCallDelta {
  id?: string;
  index: number;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export interface AiStreamHandlers {
  onTextDelta?: (delta: string) => void;
  onToolCallDelta?: (delta: AiToolCallDelta) => void;
  onFinish?: (finalText: string, finishReason?: string) => void;
  onError?: (error: Error) => void;
  // Called when OpenAI returns usage info (stream or non-stream)
  onUsage?: (usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }) => void;
}

export interface CreateChatRequest {
  settings: ChatSettings;
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  tool_choice?: "auto" | { type: "function"; function: { name: string } };
  response_format?: { type: "json_object" } | undefined;
  temperature?: number;
  signal?: AbortSignal;
}

export async function streamChatCompletion(
  req: CreateChatRequest,
  handlers: AiStreamHandlers
): Promise<void> {
  const {
    settings,
    messages,
    tools,
    tool_choice,
    response_format,
    temperature,
  } = req;
  if (!settings.openaiApiKey) {
    handlers.onError?.(new Error("Missing API key"));
    return;
  }
  // Using official OpenAI types (ChatCompletionMessageParam, ChatCompletionChunk)

  const mapMessages = (msgs: AiMessage[]): ChatCompletionMessageParam[] => {
    const out: ChatCompletionMessageParam[] = [];
    for (const m of msgs) {
      if (m.role === "system" || m.role === "user") {
        const text = m.content ?? "";
        out.push({ role: m.role, content: text });
        continue;
      }
      if (m.role === "assistant") {
        const text = m.content ?? undefined;
        if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
          out.push({
            role: "assistant",
            content: text ?? null,
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          });
        } else {
          out.push({ role: "assistant", content: text ?? null });
        }
        continue;
      }
      if (m.role === "tool") {
        const text = m.content ?? "";
        const tool_call_id = m.tool_call_id ?? "";
        out.push({ role: "tool", content: text, tool_call_id });
        continue;
      }
    }
    return out;
  };

  const mappedMessages = mapMessages(messages);
  const mappedTools: ChatCompletionTool[] | undefined = Array.isArray(tools)
    ? tools.map((t) => ({ type: "function", function: { ...t.function } }))
    : undefined;
  const mappedToolChoice =
    tool_choice === "auto"
      ? "auto"
      : tool_choice &&
        typeof tool_choice === "object" &&
        "function" in tool_choice
      ? {
          type: "function" as const,
          function: { name: tool_choice.function.name },
        }
      : undefined;

  const base = (settings.baseUrl || "https://api.openai.com").replace(
    /\/$/,
    ""
  );
  const url = `${base}/v1/chat/completions`;

  const body = {
    model: settings.model,
    messages: mappedMessages,
    stream: settings.stream,
    stream_options: { include_usage: true },
    ...(response_format ? { response_format } : {}),
    ...(mappedTools && mappedTools.length ? { tools: mappedTools } : {}),
    ...(mappedToolChoice ? { tool_choice: mappedToolChoice } : {}),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!resp.ok) {
    const t = await resp.text();
    handlers.onError?.(new Error(t || `HTTP ${resp.status}`));
    return;
  }

  if (!settings.stream) {
    const data: ChatCompletion = (await resp.json()) as ChatCompletion;
    const first = data.choices?.[0];
    const txt = (first?.message?.content ?? "") || "";
    if (data.usage)
      handlers.onUsage?.({
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      });
    await Promise.resolve(
      handlers.onFinish?.(txt, first?.finish_reason ?? undefined)
    );
    return;
  }

  if (!resp.body) {
    handlers.onError?.(new Error("No response body for stream"));
    return;
  }

  const decoder = new TextDecoder();
  const reader = resp.body.getReader();
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.replace("data: ", "");
      if (payload === "[DONE]") continue;
      try {
        const json: ChatCompletionChunk = JSON.parse(payload);
        const choice = json.choices?.[0];
        if (choice) {
          const delta = choice.delta;
          if (typeof delta.content === "string" && delta.content.length > 0) {
            full += delta.content;
            handlers.onTextDelta?.(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              handlers.onToolCallDelta?.({
                id: tc.id,
                index: tc.index,
                type: tc.type,
                function: {
                  name: tc.function?.name,
                  arguments: tc.function?.arguments,
                },
              });
            }
          }
          if (choice.finish_reason) {
            if (json.usage) handlers.onUsage?.(json.usage);
            await Promise.resolve(
              handlers.onFinish?.(full, choice.finish_reason)
            );
            return;
          }
        }
        if (json.usage) {
          handlers.onUsage?.(json.usage);
        }
      } catch {
        // ignore partial JSON lines
      }
    }
  }
}

// Helper to accumulate tool call deltas into concrete tool calls
export interface AccumulatedToolCall {
  id: string;
  name: string;
  argsText: string;
}

export function createToolCallAccumulator() {
  const calls = new Map<number, AccumulatedToolCall>();
  return {
    accept(delta: AiToolCallDelta) {
      const idx = delta.index;
      const existing = calls.get(idx) || {
        id: delta.id || "",
        name: "",
        argsText: "",
      };
      if (delta.id) existing.id = delta.id;
      if (delta.function?.name) existing.name = delta.function.name;
      if (typeof delta.function?.arguments === "string") {
        existing.argsText += delta.function.arguments;
      }
      calls.set(idx, existing);
    },
    list(): AccumulatedToolCall[] {
      return Array.from(calls.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v);
    },
  };
}

// Example tool registry interface to keep UI decoupled
export type RegisteredTool = {
  name: string;
  run: (args: unknown) => Promise<unknown>;
  description?: string;
  parameters?: FunctionParameters;
};

export function buildOpenAiTools(defs: RegisteredTool[]): AiToolDefinition[] {
  return defs.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Lightweight connectivity test to the Chat Completions endpoint
export async function testOpenAIConnection(params: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, model, baseUrl, signal } = params;
  if (!apiKey) return { ok: false, error: "Missing API key" };

  try {
    const base = (baseUrl || "https://api.openai.com").replace(/\/$/, "");
    const url = `${base}/v1/chat/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 16,
        stream: false,
      }),
      signal,
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: t || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}
