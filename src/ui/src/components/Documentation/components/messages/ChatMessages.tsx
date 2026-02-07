import React, { useMemo } from "react";
import { ChatMessage } from "../chat/ChatTypes";
import { formatRelativeTime } from "../chat/ChatUtils";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";

type Props = {
  messages: ChatMessage[];
  isTyping: boolean;
  onOpenFile: (
    file: { fileName: string; content: string; language?: string },
    title: string
  ) => void;
  onOpenDiff: (diff: any) => void;
};

export const ChatMessages: React.FC<
  Props & {
    thinkingStage?: "thinking" | "processing" | "generating";
    toolCalls?: Array<{
      id: string;
      name?: string;
      argsPreview?: string;
      status: "pending" | "running" | "done" | "error";
      resultPreview?: string;
    }>;
  }
> = React.memo(
  ({
    messages,
    isTyping,
    onOpenFile,
    onOpenDiff,
    thinkingStage,
    toolCalls,
  }) => {
    const messagesWithTime = useMemo(
      () =>
        messages.map((m) => ({
          m,
          _time: formatRelativeTime(m.timestamp),
        })),
      [messages]
    );

    return (
      <>
        {messagesWithTime.map(({ m }) => (
          <div key={m.id}>
            <MessageItem
              message={m}
              onOpenFile={onOpenFile}
              onOpenDiff={onOpenDiff}
            />
          </div>
        ))}
        {isTyping && (
          <TypingIndicator stage={thinkingStage} toolCalls={toolCalls} />
        )}
      </>
    );
  }
);
