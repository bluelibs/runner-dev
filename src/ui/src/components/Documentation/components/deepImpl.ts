import type {
  ChatState,
  DeepImplState,
  DeepImplTodoItem,
  DeepImplPatch,
  TextMessage,
  ChatMessage,
} from "./ChatTypes";

export const DEFAULT_DEEPIMPL_STATE: DeepImplState = {
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
    perTurnMax: 16000,
    usedApprox: 0,
  },
};

export function createDeepImplActions(deps: {
  getState: () => ChatState;
  setState: React.Dispatch<React.SetStateAction<ChatState>>;
  sendToOpenAI: (text: string) => Promise<void>;
}) {
  const { getState, setState, sendToOpenAI } = deps;

  const toggleDeepImpl = () => {
    setState((prev) => {
      const enabled = !(prev.deepImpl?.enabled ?? false);
      return {
        ...prev,
        deepImpl: { ...(prev.deepImpl || DEFAULT_DEEPIMPL_STATE), enabled },
      };
    });
  };

  const startDeepImplementation = (initialGoal: string) => {
    setState((prev) => {
      const flowId = `deepimpl-${Date.now()}`;
      const nextDeep: DeepImplState = {
        ...(prev.deepImpl || DEFAULT_DEEPIMPL_STATE),
        enabled: true,
        flowId,
        flowStage: "questions",
        answers: {},
        todo: [],
        logs: [
          { ts: Date.now(), text: `DeepImpl started. Goal: ${initialGoal}` },
        ],
        patch: null,
      };

      // Keep the user's goal visible in the chat as a user message
      const userGoalMessage: TextMessage = {
        id: `m-${Date.now()}`,
        author: "user",
        type: "text",
        text: initialGoal,
        timestamp: Date.now(),
      };

      return {
        ...prev,
        deepImpl: nextDeep,
        messages: [...prev.messages, userGoalMessage],
        inputValue: "",
      };
    });

    // Ask the model to propose the 3 clarification questions dynamically
          const questionPrompt = [
        "Deep Implementation kickoff.",
        "Project: Runner framework (you will be provided context via docs/graph/files). Try to assume as many things from the user as possible.",
        "Ask exactly 3 concise, high-impact clarification questions about the user's goal.",
        "The first question MUST be about the purpose/goal.",
        "The second question MUST be about constraints/limitations.",
        "The third question MUST be about the success criteria/verification.",
        "Return only the questions as a numbered list (1., 2., 3.) and nothing else.",
        `User goal: ${initialGoal}`,
      ].join("\n");

    void sendToOpenAI(questionPrompt);
  };

  const pauseDeepImplementation = () => {
    setState((prev) => ({
      ...prev,
      deepImpl: {
        ...(prev.deepImpl || DEFAULT_DEEPIMPL_STATE),
        auto: { running: false },
      },
    }));
  };

  const resumeDeepImplementation = () => {
    setState((prev) => ({
      ...prev,
      deepImpl: {
        ...(prev.deepImpl || DEFAULT_DEEPIMPL_STATE),
        auto: { running: true },
      },
    }));
    // kick the loop immediately
    void sendToOpenAI(
      [
        "DEEPIMPL_RESUME",
        "Continue with the next actionable step based on current TODOs and logs.",
      ].join("\n")
    );
  };

  const answerDeepQuestion = (answer: string) => {
    if (!answer.trim()) return;

    setState((prev) => {
      const di = prev.deepImpl || DEFAULT_DEEPIMPL_STATE;
      const answers = {
        ...(di.answers || {}),
      };

      // This logic is now more reliable due to the improved prompt
      if (!answers.purpose) {
        answers.purpose = answer.trim();
      } else if (!answers.constraints) {
        answers.constraints = answer.trim();
      } else if (!answers.success) {
        answers.success = answer.trim();
      }

      let filled = 0;
      if (answers.purpose) filled++;
      if (answers.constraints) filled++;
      if (answers.success) filled++;

      const messages: ChatMessage[] = [
        ...prev.messages,
        {
          id: `m-${Date.now()}`,
          author: "user",
          type: "text",
          text: answer.trim(),
          timestamp: Date.now(),
        } as TextMessage,
      ];

      if (filled < 3) {
        return {
          ...prev,
          deepImpl: { ...di, answers },
          messages,
          inputValue: "",
        };
      }

      // All questions answered, transition to planning phase and kick off the agent
      const planMsg: TextMessage = {
        id: `b-${Date.now()}-deepimpl-plan`,
        author: "bot",
        type: "text",
        text: [
          "Thanks. I will create a TODO plan and begin Deep Research.",
          "I'll keep the plan updated and report each step.",
        ].join("\n"),
        timestamp: Date.now(),
      };

      const planningPrompt = [
        "DEEPIMPL_START",
        // Plan phase: ask for a JSON TODO plan via tool call
        "First, create a TODO plan via deepimpl_todo_init (MUST call this tool).",
        "Then proceed agentically to complete items, updating with deepimpl_todo_update and deepimpl_log.",
        "Use deepimpl_set_stage to reflect progress (plan -> explore -> implement -> patch.ready).",
        // Budget
        "Respect the total output token budget of 65500: call deepimpl_budget_get and operate in chunks.",
        "Stop when TODOs are complete or budget remaining is 0 (or user stops).",
        // Context acquisition
        "Use get_project_overview and get_element_graph to scope, then targeted file reads.",
        // Deliverable
        "At implement stage, synthesize a strict JSON DeepImplPatch (no extra prose).",
        "Answers:",
        `- Purpose: ${answers.purpose || ""}`,
        `- Constraints: ${answers.constraints || ""}`,
        `- Success: ${answers.success || ""}`,
      ].join("\n");

      try {
        // Start the agentic loop after planning by setting auto.running
        void sendToOpenAI(planningPrompt);
      } catch (e) {
        console.error("DeepImpl: Failed to send planning prompt to OpenAI", e); // TODO: Update state to show an error message to the user
      }

      return {
        ...prev,
        deepImpl: {
          ...di,
          answers,
          flowStage: "plan",
          auto: { running: true },
        },
        messages: [...messages, planMsg],
        inputValue: "",
      };
    });
  };

  return {
    toggleDeepImpl,
    startDeepImplementation,
    answerDeepQuestion,
    pauseDeepImplementation,
    resumeDeepImplementation,
  } as const;
}
