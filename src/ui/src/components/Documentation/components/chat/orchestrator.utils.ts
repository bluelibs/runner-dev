import type { Dispatch, SetStateAction } from "react";
import { ChatState, TextMessage } from "./ChatTypes";

// Update live tool-calls list from a streaming delta
export function applyToolCallDelta(
  setChatState: Dispatch<SetStateAction<ChatState>>,
  delta: any
) {
  setChatState((prev) => {
    const existing = prev.toolCalls || [];
    const idx = delta.index;
    const prevItem = existing[idx];
    const name = delta.function?.name || prevItem?.name;
    const nextArgs =
      (prevItem?.argsPreview || "") + (delta.function?.arguments || "");
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
}

// Set a full planned list of tool-calls with pending status
export function setPlannedToolCalls(
  setChatState: Dispatch<SetStateAction<ChatState>>,
  calls: Array<{ id?: string; name: string; argsText?: string }>
) {
  setChatState((prev) => ({
    ...prev,
    thinkingStage: "processing",
    toolCalls: calls.map((c, i) => ({
      id: c.id || String(i),
      name: c.name,
      argsPreview: c.argsText || "",
      status: "pending",
    })),
  }));
}

// Mark a specific tool-call status (and optionally attach a result preview)
export function setToolCallStatus(
  setChatState: Dispatch<SetStateAction<ChatState>>,
  index: number,
  status: "pending" | "running" | "done" | "error",
  resultPreview?: string
) {
  setChatState((prev) => ({
    ...prev,
    toolCalls: (prev.toolCalls || []).map((t, idx) =>
      idx === index
        ? { ...t, status, ...(resultPreview ? { resultPreview } : {}) }
        : t
    ),
  }));
}

// Attach the current toolCalls summary to the last assistant text message
export function attachToolCallsToLastAssistantMessage(
  setChatState: Dispatch<SetStateAction<ChatState>>
) {
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
}

// Push a new assistant text bubble and copy current toolCalls into it
export function addAssistantBubbleWithToolCalls(
  setChatState: Dispatch<SetStateAction<ChatState>>,
  id: string
) {
  setChatState((prev) => ({
    ...prev,
    messages: [
      ...prev.messages,
      {
        id,
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
}
