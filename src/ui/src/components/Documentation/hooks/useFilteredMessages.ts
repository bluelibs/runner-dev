import { useMemo } from "react";
import { ChatMessage, TextMessage } from "../components/ChatTypes";

export function useFilteredMessages(
  messages: ChatMessage[],
  isTyping: boolean
) {
  return useMemo(() => {
    return messages.filter((m) => {
      if (
        isTyping &&
        m.author === "bot" &&
        m.type === "text" &&
        !(m as TextMessage).text.trim()
      ) {
        return false;
      }
      return true;
    });
  }, [messages, isTyping]);
}
