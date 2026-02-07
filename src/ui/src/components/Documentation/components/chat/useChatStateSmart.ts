import { useNewSmart } from "@bluelibs/smart";
import { useEffect } from "react";
import { ChatSmart } from "./ChatSmart";
import type { ChatState, AvailableElements } from "./ChatTypes";
import type { DocsBundle } from "./ChatUtils";

export const useChatStateSmart = (opts?: {
  availableElements?: AvailableElements;
  docs?: DocsBundle;
}) => {
  const docsBundle: DocsBundle = {
    runnerAiMd: opts?.docs?.runnerAiMd || null,
    graphqlSdl: opts?.docs?.graphqlSdl || null,
    runnerDevMd: opts?.docs?.runnerDevMd || null,
    projectOverviewMd: opts?.docs?.projectOverviewMd || null,
  };

  // Create ChatSmart instance with constructor arguments
  const [chatModel] = useNewSmart(
    ChatSmart,
    docsBundle,
    opts?.availableElements || {}
  );

  // Persist messages when they change (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      chatModel.persistChatHistory();
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chatModel.messages]);

  // Get computed state directly from Smart model
  // This will automatically trigger re-renders when Smart state changes
  const chatState = chatModel.getStateAsChatState();

  // Get computed properties
  const computedProps = {
    canRetry: chatModel.canRetry,
    tokenStatus: chatModel.tokenStatus,
    liveEstimate: chatModel.liveEstimate,
  };

  return {
    // State
    chatState,

    // Provide setChatState for compatibility with existing components
    setChatState: (updater: React.SetStateAction<ChatState>) => {
      if (typeof updater === "function") {
        const newState = updater(chatModel.getStateAsChatState());
        // Update the ChatSmart state based on the new state
        Object.assign(chatModel, newState);
        chatModel.inform();
      } else {
        // Direct state replacement
        Object.assign(chatModel, updater);
        chatModel.inform();
      }
    },

    // Core messaging methods
    sendMessage: chatModel.sendMessage.bind(chatModel),
    sendMessageWithText: chatModel.sendMessageWithText.bind(chatModel),
    retryLastResponse: chatModel.retryLastResponse.bind(chatModel),
    stopRequest: chatModel.stopRequest.bind(chatModel),
    clearChat: chatModel.clearChat.bind(chatModel),

    // Settings methods
    updateSettings: chatModel.updateSettings.bind(chatModel),
    testOpenAIConnection: chatModel.testOpenAIConnection.bind(chatModel),

    // Context methods
    updateChatContext: chatModel.updateChatContext.bind(chatModel),
    updateStickyDocs: chatModel.updateStickyDocs.bind(chatModel),

    // UI state methods
    setInputValue: chatModel.setInputValue.bind(chatModel),
    setSearchQuery: chatModel.setSearchQuery.bind(chatModel),
    setSelectedMessageId: chatModel.setSelectedMessageId.bind(chatModel),

    // Deep Implementation methods
    enableDeepImplementation:
      chatModel.enableDeepImplementation.bind(chatModel),
    setDeepImplAnswers: chatModel.setDeepImplAnswers.bind(chatModel),
    continueDeepImplFlow: chatModel.continueDeepImplFlow.bind(chatModel),

    // Computed properties
    ...computedProps,
  };
};
