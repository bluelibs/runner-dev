import { useEffect, useMemo, useState } from "react";
import { TextMessage } from "../components/ChatTypes";

export type TokenDocs = {
  runnerAiMd?: string | null;
  graphqlSdl?: string | null;
  runnerDevMd?: string | null;
  projectOverviewMd?: string | null;
};

export type TokenBreakdown = {
  system: number;
  history: number;
  input: number;
};

export function useTokenEstimates(
  systemPrompt: string,
  messages: Array<TextMessage>,
  inputValue: string,
  docs: TokenDocs
) {
  const [total, setTotal] = useState<number>(0);
  const [breakdown, setBreakdown] = useState<TokenBreakdown>({
    system: 0,
    history: 0,
    input: 0,
  });

  const estimate = useMemo(() => {
    return (txt: string) => Math.ceil((txt || "").length / 4);
  }, []);

  useEffect(() => {
    try {
      const historyText = messages.map((m) => m.text || "").join("\n\n");
      const includesRunner = /@docs\.runner\b/.test(inputValue || "");
      const includesSchema = /@docs\.schema\b/.test(inputValue || "");
      const includesRunnerDev = /@docs\.runnerDev\b/.test(inputValue || "");
      const includesProject = /@docs\.projectOverview\b/.test(inputValue || "");

      const systemTokens = estimate(systemPrompt);
      const historyTokens = estimate(historyText);
      const docsTokens =
        (includesRunner && docs.runnerAiMd ? estimate(docs.runnerAiMd) : 0) +
        (includesSchema && docs.graphqlSdl ? estimate(docs.graphqlSdl) : 0) +
        (includesRunnerDev && docs.runnerDevMd
          ? estimate(docs.runnerDevMd)
          : 0) +
        (includesProject && docs.projectOverviewMd
          ? estimate(docs.projectOverviewMd)
          : 0);

      const inputTokens = estimate(inputValue || "") + docsTokens;
      const nextTotal = systemTokens + historyTokens + inputTokens;

      setTotal(nextTotal);
      setBreakdown({
        system: systemTokens,
        history: historyTokens,
        input: inputTokens,
      });
    } catch {
      setTotal(0);
      setBreakdown({ system: 0, history: 0, input: 0 });
    }
  }, [systemPrompt, messages, inputValue, docs, estimate]);

  return { total, breakdown };
}
