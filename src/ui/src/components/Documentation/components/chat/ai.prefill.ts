import { loadChatSettings } from "./ChatUtils";
import { streamChatCompletion, AiMessage } from "./ai.service";
import type { ChatSettings } from "./ChatTypes";

export const hasOpenAIKey = (): boolean => {
  try {
    const settings = loadChatSettings();
    return Boolean(settings?.openaiApiKey);
  } catch {
    return false;
  }
};

/**
 * Ask the model to produce a JSON instance that conforms to the provided JSON Schema.
 * Returns a parsed object on success. Throws on missing API key or network errors.
 */
export async function generateInstanceFromJsonSchema(
  schemaString: string,
  opts?: { temperature?: number; settingsOverride?: Partial<ChatSettings> }
): Promise<any> {
  const saved = loadChatSettings();
  if (!saved?.openaiApiKey) {
    throw new Error(
      "OpenAI API key not set. Configure it in Chat settings to enable AI fill."
    );
  }
  const settings: ChatSettings = {
    ...saved,
    stream: false,
    // keep the selected model/baseUrl/key; response will still be plain text we parse as JSON
  } as ChatSettings;

  const system = [
    "You are a strict JSON generator.",
    "Given a JSON Schema, return ONLY a JSON instance that strictly conforms to it.",
    "Output must be valid JSON with no comments, no code fences, and no trailing text.",
    "Prefer realistic values. Keep arrays short (1-2 items).",
  ].join(" \n");

  const user = [
    "Produce a single JSON object that validates against this JSON Schema. Try not to use generic values, let them have real-life values so there is variety each time.",
    "Helpful seed: " + Math.random(),
    "If fields are optional, you may omit them unless they provide clarity.",
    "JSON Schema:",
    "<json_schema>",
    schemaString,
    "</json_schema>",
  ].join("\n\n");

  const messages: AiMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let finalText = "";

  await streamChatCompletion(
    {
      settings,
      messages,
      response_format: { type: "json_object" },
      temperature: opts?.temperature ?? 0.2,
    },
    {
      onFinish: (txt) => {
        finalText = txt || "";
      },
      onError: (err) => {
        throw err;
      },
    }
  );

  // Try parsing; if model returned minor wrappers, trim to the first/last braces
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const sliced = s.slice(start, end + 1);
        return JSON.parse(sliced);
      }
      throw new Error("Model did not return valid JSON");
    }
  };

  return tryParse(finalText);
}
