import { ChatSettings } from "./ChatTypes";
import type { AiMessage } from "./ai.service";

export type DocsBundle = {
  runnerAiMd?: string | null;
  graphqlSdl?: string | null;
  runnerDevMd?: string | null;
  projectOverviewMd?: string | null;
};

export type DocsIncludeFlags = {
  runner?: boolean;
  runnerDev?: boolean;
  schema?: boolean;
  projectOverview?: boolean;
};

export const estimateTokens = (text: string): number =>
  Math.ceil((text || "").length / 4);

export const expandDocsInMessage = (
  raw: string,
  docs: DocsBundle
): { modelText: string; displayText: string } => {
  const additions: string[] = [];
  const displayText = raw;
  if (/@docs\.runner\b/.test(raw) && docs.runnerAiMd) {
    additions.push(`\n\n<runner_docs>\n${docs.runnerAiMd}\n</runner_docs>`);
  }
  if (/@docs\.schema\b/.test(raw) && docs.graphqlSdl) {
    additions.push(`\n\n<graphql_sdl>\n${docs.graphqlSdl}\n</graphql_sdl>`);
  }
  if (/@docs\.runnerDev\b/.test(raw) && docs.runnerDevMd) {
    additions.push(
      `\n\n<runner_dev_docs>\n${docs.runnerDevMd}\n</runner_dev_docs>`
    );
  }
  if (/@docs\.projectOverview\b/.test(raw) && docs.projectOverviewMd) {
    const trimmed = (docs.projectOverviewMd || "").trim();
    const label = trimmed.startsWith("#")
      ? "project_overview"
      : "project_ai_md";
    additions.push(`\n\n<${label}>\n${trimmed}\n</${label}>`);
  }
  if (additions.length === 0) {
    return { modelText: raw, displayText };
  }
  const cleaned = raw.replace(
    /\s*@docs\.(runner|schema|projectOverview|runnerDev)\b/g,
    ""
  );
  const modelText = `${cleaned}${additions.join("")}`;
  return { modelText, displayText };
};

export const computeContextEstimate = (
  systemPrompt: string,
  historyMessages: Array<{ text: string }> | string[],
  inputValue: string,
  docs: DocsBundle
): { system: number; history: number; input: number; total: number } => {
  const historyText = Array.isArray(historyMessages)
    ? (historyMessages as any[])
        .map((m) => (typeof m === "string" ? m : m.text || ""))
        .join("\n\n")
    : String(historyMessages || "");

  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = estimateTokens(historyText);
  const includesRunner = /@docs\.runner\b/.test(inputValue || "");
  const includesSchema = /@docs\.schema\b/.test(inputValue || "");
  const includesRunnerDev = /@docs\.runnerDev\b/.test(inputValue || "");
  const includesProject = /@docs\.projectOverview\b/.test(inputValue || "");

  const docsTokens =
    (includesRunner && docs.runnerAiMd ? estimateTokens(docs.runnerAiMd) : 0) +
    (includesSchema && docs.graphqlSdl ? estimateTokens(docs.graphqlSdl) : 0) +
    (includesRunnerDev && docs.runnerDevMd
      ? estimateTokens(docs.runnerDevMd)
      : 0) +
    (includesProject && docs.projectOverviewMd
      ? estimateTokens(docs.projectOverviewMd)
      : 0);

  const inputTokens = estimateTokens(inputValue || "") + docsTokens;
  const total = systemTokens + historyTokens + inputTokens;
  return {
    system: systemTokens,
    history: historyTokens,
    input: inputTokens,
    total,
  };
};

export const buildDocsBlock = (
  docs: DocsBundle,
  include: DocsIncludeFlags
): string => {
  const parts: string[] = [];
  if (include.runner && docs.runnerAiMd) {
    parts.push(`<runner_docs>\n${docs.runnerAiMd}\n</runner_docs>`);
  }
  if (include.runnerDev && docs.runnerDevMd) {
    parts.push(`<runner_dev_docs>\n${docs.runnerDevMd}\n</runner_dev_docs>`);
  }
  if (include.schema && docs.graphqlSdl) {
    parts.push(`<graphql_sdl>\n${docs.graphqlSdl}\n</graphql_sdl>`);
  }
  if (include.projectOverview && docs.projectOverviewMd) {
    const trimmed = (docs.projectOverviewMd || "").trim();
    const label = trimmed.startsWith("#")
      ? "project_overview"
      : "project_ai_md";
    parts.push(`<${label}>\n${trimmed}\n</${label}>`);
  }
  return parts.join("\n\n");
};

export const buildRequestMessages = (
  systemPrompt: string,
  include: DocsIncludeFlags,
  history: AiMessage[],
  input: string,
  docs: DocsBundle
): AiMessage[] => {
  const msgs: AiMessage[] = [{ role: "system", content: systemPrompt }];
  // Keep stable conversation history first for better caching
  msgs.push(...history);

  // Inject docs block inline in sequence (not at the top) unless input already includes hidden docs
  const docsBlock = buildDocsBlock(docs, include);
  const inputContainsHiddenDocs =
    /<(runner_docs|runner_dev_docs|graphql_sdl|project_overview|project_ai_md)>/i.test(
      input || ""
    );
  if (docsBlock && !inputContainsHiddenDocs) {
    msgs.push({ role: "system", content: docsBlock });
  }

  msgs.push({ role: "user", content: input });
  return msgs;
};

const parseDocsTokensFromInput = (inputValue: string): DocsIncludeFlags => {
  const tokenRe =
    /\s*@docs\.(runnerDev|runner|schema|projectOverview|fullContext|clear)\b/g;
  const found: string[] = [];
  (inputValue || "").replace(tokenRe, (m) => {
    found.push(m.trim());
    return m;
  });

  const includes: DocsIncludeFlags = {
    runner: false,
    runnerDev: false,
    schema: false,
    projectOverview: false,
  };

  for (const t of found) {
    if (t.endsWith("clear")) {
      includes.runner = false;
      includes.runnerDev = false;
      includes.schema = false;
      includes.projectOverview = false;
      continue;
    }
    if (t.endsWith("runner")) includes.runner = true;
    if (t.endsWith("runnerDev")) includes.runnerDev = true;
    if (t.endsWith("schema")) includes.schema = true;
    if (t.endsWith("projectOverview")) includes.projectOverview = true;
    if (t.endsWith("fullContext")) {
      includes.runner = true;
      includes.schema = true;
      includes.projectOverview = true;
    }
  }

  return includes;
};

export const computeContextEstimateFromContext = (
  systemPrompt: string,
  historyTexts: string[],
  inputValue: string,
  docs: DocsBundle,
  include: DocsIncludeFlags
) => {
  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = estimateTokens((historyTexts || []).join("\n\n"));

  // Parse @docs tokens from input and merge with persistent includes
  const inputDocsFlags = parseDocsTokensFromInput(inputValue || "");
  const mergedIncludes: DocsIncludeFlags = {
    runner: include.runner || inputDocsFlags.runner,
    runnerDev: include.runnerDev || inputDocsFlags.runnerDev,
    schema: include.schema || inputDocsFlags.schema,
    projectOverview: include.projectOverview || inputDocsFlags.projectOverview,
  };

  const docsBlock = buildDocsBlock(docs, mergedIncludes);
  const docsTokens = estimateTokens(docsBlock);
  const inputTokens = estimateTokens(inputValue || "");
  const total = systemTokens + historyTokens + docsTokens + inputTokens;
  return {
    system: systemTokens,
    history: historyTokens,
    input: inputTokens + docsTokens, // keep legacy breakdown: input includes docs
    total,
  };
};

export const generateUnifiedDiff = (
  prevContent: string,
  newContent: string,
  fileName: string
): string => {
  const prevLines = prevContent.split("\n");
  const newLines = newContent.split("\n");

  let diff = `--- a/${fileName}\n+++ b/${fileName}\n`;

  // Simple line-by-line diff (in production, use a proper diff library like diff2html)
  const maxLines = Math.max(prevLines.length, newLines.length);
  let hunkStart = 0;
  let hunkLines: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const prevLine = prevLines[i];
    const newLine = newLines[i];

    if (prevLine === newLine) {
      hunkLines.push(` ${prevLine || ""}`);
    } else {
      if (prevLine !== undefined) {
        hunkLines.push(`-${prevLine}`);
      }
      if (newLine !== undefined) {
        hunkLines.push(`+${newLine}`);
      }
    }
  }

  if (hunkLines.length > 0) {
    diff += `@@ -${hunkStart + 1},${prevLines.length} +${hunkStart + 1},${
      newLines.length
    } @@\n`;
    diff += hunkLines.join("\n");
  }

  return diff;
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (seconds < 30) return "now";
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn("Failed to copy to clipboard:", err);
    return false;
  }
};

export const parseMessageForFiles = (text: string) => {
  const fileRegex = /\[([^\]]+)\]/g;
  const parts: Array<{ type: "text" | "file"; content: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = fileRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "file", content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
};

export const getThinkingText = (
  stage: "none" | "thinking" | "processing" | "generating"
): string => {
  switch (stage) {
    case "thinking":
      return "Thinking";
    case "processing":
      return "Processing";
    case "generating":
      return "Generating response";
    default:
      return "";
  }
};

export const saveChatHistory = (messages: any[]) => {
  try {
    localStorage.setItem(
      "chat-sidebar-history",
      JSON.stringify({
        messages,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn("Failed to save chat history:", e);
  }
};

export const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem("chat-sidebar-history");
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.messages || [];
    }
  } catch (e) {
    console.warn("Failed to load chat history:", e);
  }
  return null;
};

export const saveChatSettings = (settings: ChatSettings) => {
  try {
    localStorage.setItem("chat-sidebar-settings", JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save chat settings:", e);
  }
};

export const loadChatSettings = (): ChatSettings | null => {
  try {
    const saved = localStorage.getItem("chat-sidebar-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        openaiApiKey: parsed.openaiApiKey ?? null,
        model: parsed.model ?? "gpt-5-mini",
        stream: parsed.stream ?? true,
        responseMode: parsed.responseMode === "json" ? "json" : "text",
        baseUrl: parsed.baseUrl ?? "https://api.openai.com",
      } as ChatSettings;
    }
  } catch (e) {
    console.warn("Failed to load chat settings:", e);
  }
  return null;
};

// Persist thread-level docs include context so @docs.* toggles survive refreshes
export const saveChatContext = (ctx: { include?: DocsIncludeFlags } | null) => {
  try {
    if (!ctx || !ctx.include) {
      localStorage.removeItem("chat-sidebar-context");
      return;
    }
    localStorage.setItem(
      "chat-sidebar-context",
      JSON.stringify({ include: ctx.include, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn("Failed to save chat context:", e);
  }
};

export const loadChatContext = (): { include: DocsIncludeFlags } | null => {
  try {
    const saved = localStorage.getItem("chat-sidebar-context");
    if (saved) {
      const parsed = JSON.parse(saved);
      const include = (parsed?.include || {}) as DocsIncludeFlags;
      return { include };
    }
  } catch (e) {
    console.warn("Failed to load chat context:", e);
  }
  return null;
};

export const clearChatContext = () => {
  try {
    localStorage.removeItem("chat-sidebar-context");
  } catch (e) {
    console.warn("Failed to clear chat context:", e);
  }
};
