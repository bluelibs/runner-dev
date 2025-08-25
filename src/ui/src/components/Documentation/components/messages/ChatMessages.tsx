import React, { useMemo } from "react";
import { ChatMessage, TextMessage } from "../ChatTypes";
import { formatRelativeTime } from "../ChatUtils";
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

export const ChatMessages: React.FC<Props> = React.memo(
  ({ messages, isTyping, onOpenFile, onOpenDiff }) => {
    const messagesWithTime = useMemo(
      () =>
        messages.map((m) => ({
          m,
          time: formatRelativeTime(m.timestamp),
        })),
      [messages]
    );

    return (
      <>
        {messagesWithTime.map(({ m, time }) => (
          <div key={m.id}>
            <MessageItem
              message={m}
              onOpenFile={onOpenFile}
              onOpenDiff={onOpenDiff}
            />
          </div>
        ))}
        {isTyping && <TypingIndicator />}
      </>
    );
  }
);
