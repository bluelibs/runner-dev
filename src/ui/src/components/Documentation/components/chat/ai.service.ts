import { ChatSettings } from "./ChatTypes";

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
    parameters?: unknown; // keep generic for now to avoid any
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
  temperature?: number;
  response_format?: { type: "json_object" } | undefined;
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
    temperature,
    response_format,
  } = req;
  if (!settings.openaiApiKey) {
    handlers.onError?.(new Error("Missing API key"));
    return;
  }

  const body: any = {
    model: settings.model,
    messages,
    stream: settings.stream,
    max_completion_tokens: 16000,
    // temperature: temperature ?? 0.2,
  };

  if (response_format) body.response_format = response_format;
  if (tools && tools.length) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const base = (settings.baseUrl || "https://api.openai.com").replace(
    /\/$/,
    ""
  );
  const url = `${base}/v1/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    // Ask OpenAI to include usage in streamed responses when streaming
    body: JSON.stringify(
      settings.stream
        ? { ...body, stream_options: { include_usage: true } }
        : body
    ),
    signal: req.signal,
  });

  if (!resp.ok) {
    const t = await resp.text();
    handlers.onError?.(new Error(t || `HTTP ${resp.status}`));
    return;
  }

  if (!settings.stream) {
    const data = await resp.json();
    const txt: string = data?.choices?.[0]?.message?.content || "";
    const fr: string | undefined = data?.choices?.[0]?.finish_reason;
    // Non-stream responses include usage directly
    if (data?.usage) {
      handlers.onUsage?.({
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      });
    }
    handlers.onFinish?.(txt, fr);
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
        const json = JSON.parse(payload);
        const choice = json?.choices?.[0];
        const delta = choice?.delta;
        const finishReason: string | undefined = choice?.finish_reason;

        // Streamed usage (when stream_options.include_usage is true)
        if (json?.usage) {
          handlers.onUsage?.({
            prompt_tokens: json.usage.prompt_tokens,
            completion_tokens: json.usage.completion_tokens,
            total_tokens: json.usage.total_tokens,
          });
        }

        if (delta?.content) {
          full += delta.content;
          handlers.onTextDelta?.(delta.content);
        }

        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            handlers.onToolCallDelta?.({
              id: tc.id,
              index: tc.index,
              type: tc.type,
              function: tc.function,
            });
          }
        }

        if (finishReason) {
          handlers.onFinish?.(full, finishReason);
          return; // stop reading further once we received a finish
        }
      } catch {
        // ignore partial lines
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
  parameters?: unknown;
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
