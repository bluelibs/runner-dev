import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { CodeModal } from "./CodeModal";
import { FileDiff } from "./ChatTypes";
import {
  parseElementReferences,
  fetchElementFileContentsBySearch,
} from "../utils/fileContentUtils";
import { graphqlRequest } from "../utils/graphqlClient";
import "./ArchitectPanel.scss";

export type ArchitectPanelProps = {
  settings: {
    openaiApiKey: string | null;
    model: string;
    baseUrl: string | null;
  };
  availableElements?: {
    tasks: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    resources: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    events: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    hooks: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    middlewares: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
    tags: Array<{
      id: string;
      name: string;
      title?: string;
      description?: string;
    }>;
  };
  docs?: {
    runnerAiMd?: string | null;
    graphqlSdl?: string | null;
    runnerDevMd?: string | null;
    projectOverviewMd?: string | null;
  };
};

export type ArchitectPanelHandle = {
  submit: (text: string) => void;
  research: (text?: string) => void;
  plan: (text?: string) => void;
};

export const ArchitectPanel = React.forwardRef<
  ArchitectPanelHandle,
  ArchitectPanelProps
>(function ArchitectPanel({ settings, availableElements, docs }, ref) {
  type ArchitectPatch = {
    removeLines?: number[];
    inject?: string;
  };

  type ArchitectChange = {
    op:
      | "create_file"
      | "update_file"
      | "delete_file"
      | "add_file"
      | "change_file";
    path: string;
    description?: string;
    oldContent?: string | null;
    newContent?: string | null;
    language?: string | null;
    patch?: ArchitectPatch | null;
  };

  type ArchitectPlan = {
    version: number;
    goal: string;
    changes: ArchitectChange[];
    notes?: string;
    research?: Array<{ note: string; path?: string | null }>;
  } | null;

  const [goal, setGoal] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ArchitectPlan>(null);
  const [researchFiles, setResearchFiles] = useState<
    Array<{ id: string; filePath: string | null; fileContents: string | null }>
  >([]);

  const [codeModal, setCodeModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    content: string;
    language?: string;
  }>({ isOpen: false, title: "", content: "" });

  const inferLanguageFromPath = useCallback((p?: string | null): string => {
    if (!p) return "plaintext";
    const lower = p.toLowerCase();
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
    if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".graphql") || lower.endsWith(".gql")) return "graphql";
    if (lower.endsWith(".md")) return "markdown";
    if (lower.endsWith(".scss") || lower.endsWith(".css")) return "css";
    if (lower.endsWith(".html")) return "html";
    return "plaintext";
  }, []);

  const openFileModal = useCallback(
    (
      file: { fileName: string; content: string; language?: string },
      title: string
    ) => {
      setCodeModal({
        isOpen: true,
        title,
        subtitle: file.fileName,
        content: file.content,
        language: file.language,
      });
    },
    []
  );

  const openDiffModal = useCallback((diff: FileDiff) => {
    // Inline unified diff generator to keep decoupled: simple header format
    const generateUnifiedDiff = (a: string, b: string, name: string) => {
      const header = `--- a/${name}\n+++ b/${name}\n`;
      return header + `@@ -1 +1 @@\n` + `-${a}\n+${b}\n`;
    };
    setCodeModal({
      isOpen: true,
      title: `Diff: ${diff.fileName}`,
      subtitle: "Unified diff format",
      content:
        diff.diffText ||
        generateUnifiedDiff(
          diff.previousVersion,
          diff.newVersion,
          diff.fileName
        ),
      language: "diff",
    });
  }, []);

  const openPatchModal = useCallback((path: string, patch: ArchitectPatch) => {
    const pretty = JSON.stringify(
      {
        path,
        patch,
      },
      null,
      2
    );
    setCodeModal({
      isOpen: true,
      title: `Patch: ${path}`,
      subtitle: "Surgical change",
      content: pretty,
      language: "json",
    });
  }, []);

  const closeModal = useCallback(
    () => setCodeModal((p) => ({ ...p, isOpen: false })),
    []
  );

  const runResearch = useCallback(async () => {
    if (!availableElements || !goal.trim()) {
      setResearchFiles([]);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const refs = parseElementReferences(goal, availableElements);
      const ids = Array.from(new Set(refs.map((r) => r.elementId)));
      const results = await Promise.all(
        ids.map((id) => fetchElementFileContentsBySearch(id))
      );
      const filtered = (
        results.filter(Boolean) as Array<{
          id: string;
          filePath: string | null;
          fileContents: string | null;
        }>
      ).map((r) => ({ ...r }));
      setResearchFiles(filtered);
    } catch (e: any) {
      setError(e?.message || "Failed to run research phase");
    } finally {
      setIsBusy(false);
    }
  }, [goal, availableElements]);

  // Simple function-calling loop using OpenAI tools
  const requestPlan = useCallback(async () => {
    if (!settings.openaiApiKey) {
      setError("OpenAI API key is missing. Configure it in settings.");
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const base = (settings.baseUrl || "https://api.openai.com").replace(
        /\/$/,
        ""
      );
      const url = `${base}/v1/chat/completions`;

      const tools = [
        {
          type: "function",
          function: {
            name: "get_runner_doc",
            description: "Return the Runner AI.md documentation text.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_schema_sdl",
            description: "Return the GraphQL SDL of the system.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_runner_dev_doc",
            description: "Return the Runner-Dev documentation text.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_project_overview_doc",
            description: "Return the Project Overview documentation text.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_available_elements",
            description:
              "List available element names and ids for tasks/resources/events/hooks/middlewares/tags.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "search_elements",
            description:
              "Search elements by idIncludes (substring). Returns an array of {id, filePath}.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_element_file_contents",
            description:
              "Get file contents for a single element id (uses universal search).",
            parameters: {
              type: "object",
              properties: { id: { type: "string" } },
              required: ["id"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_file_contents_by_element_ids",
            description:
              "Get file contents for multiple element ids. Returns array aligned to input order.",
            parameters: {
              type: "object",
              properties: {
                items: { type: "array", items: { type: "string" } },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      ];

      const system = [
        "You are an expert software architect.",
        "You have function-calling tools to read docs and retrieve file contents. Use them to research before planning.",
        "When you are done, output ONLY JSON following this schema:",
        '{"version":1,"goal":"string","changes":[{"op":"add_file|change_file|delete_file","path":"string","description":"string(optional)","oldContent":"string|null(optional)","newContent":"string|null(optional)","language":"string(optional)","patch":{"removeLines":[Int],"inject":"string"}}],"notes":"string(optional)","research":[{"note":"string","path":"string(optional)"}]}',
        "Rules:",
        "- Prefer intelligent changesets: for files <= 50 lines, provide full replacement (newContent).",
        "- For larger files, prefer a patch with removeLines (favor removing entire blocks) and inject (full block to add).",
        "- Be conservative and align patches to logical blocks.",
        "- Use absolute or structured paths (eg. workspace:src/...).",
        "- Do not include any text outside the JSON.",
      ].join("\n");

      const user = [
        `GOAL: ${goal.trim()}`,
        "Use the tools to read any necessary documentation and source files before producing the plan.",
        "Available documentation tools: get_runner_doc, get_schema_sdl, get_runner_dev_doc, get_project_overview_doc.",
        "Available code tools: list_available_elements, search_elements, get_element_file_contents, get_file_contents_by_element_ids.",
      ].join("\n");

      const runTool = async (name: string, argsJson: string) => {
        try {
          const args = argsJson ? JSON.parse(argsJson) : {};

          switch (name) {
            case "get_runner_doc":
              return { text: docs?.runnerAiMd || "" };
            case "get_schema_sdl":
              return { text: docs?.graphqlSdl || "" };
            case "get_runner_dev_doc":
              return { text: docs?.runnerDevMd || "" };
            case "get_project_overview_doc":
              return { text: docs?.projectOverviewMd || "" };
            case "list_available_elements":
              return availableElements || {};
            case "search_elements": {
              const q = String(args.query || "");
              const QUERY = `query All($idIncludes: ID!) { all(idIncludes: $idIncludes) { id filePath __typename } }`;
              const res = await graphqlRequest<{
                all: Array<{ id: string; filePath: string | null }>;
              }>(QUERY, { idIncludes: q });
              return { results: res.all || [] };
            }
            case "get_element_file_contents": {
              const id = String(args.id || "");
              const r = await fetchElementFileContentsBySearch(id);
              return r || { id, filePath: null, fileContents: null };
            }
            case "get_file_contents_by_element_ids": {
              const items = (Array.isArray(args.items) ? args.items : []).map(
                String
              );
              const results = await Promise.all(
                items.map((id: string) => fetchElementFileContentsBySearch(id))
              );
              return results.map(
                (r, idx) =>
                  r ?? { id: items[idx], filePath: null, fileContents: null }
              );
            }
            default:
              return { error: `Unknown tool: ${name}` };
          }
        } catch (e: any) {
          return { error: e?.message || "Tool execution error" };
        }
      };

      const messages: Array<any> = [
        { role: "system", content: system },
        { role: "user", content: user },
      ];

      let finalContent: string | null = null;

      for (let i = 0; i < 3; i++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.1,
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(t || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const msg = data?.choices?.[0]?.message;
        const toolCalls = msg?.tool_calls || [];
        if (toolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: msg.content || "",
            tool_calls: toolCalls,
          });
          for (const tc of toolCalls) {
            const name = tc?.function?.name || "";
            const argsText = tc?.function?.arguments || "{}";
            const result = await runTool(name, argsText);
            messages.push({
              role: "tool",
              name,
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
          continue;
        }
        finalContent = msg?.content || "";
        break;
      }

      if (!finalContent) {
        throw new Error("No content from AI");
      }

      // Parse and normalize plan
      const parsedRaw = JSON.parse(finalContent);
      const normalizeOp = (op: string): ArchitectChange["op"] => {
        if (op === "add_file") return "create_file";
        if (op === "change_file") return "update_file";
        return op as any as ArchitectChange["op"]; // delete_file|create_file|update_file
      };
      const changes: ArchitectChange[] = (parsedRaw.changes || []).map(
        (c: any) => {
          const patch = c.patch || c.PATCH || null;
          const removeLines =
            patch?.removeLines ||
            patch?.REMOVE_LINES ||
            patch?.["REMOVE-LINES"] ||
            undefined;
          const inject = patch?.inject || patch?.INJECT || undefined;
          return {
            op: normalizeOp(String(c.op)),
            path: String(c.path),
            description: c.description ? String(c.description) : undefined,
            oldContent:
              typeof c.oldContent === "string" ? c.oldContent : undefined,
            newContent:
              typeof c.newContent === "string" ? c.newContent : undefined,
            language: c.language ? String(c.language) : undefined,
            patch: patch ? { removeLines, inject } : null,
          } as ArchitectChange;
        }
      );

      //   setPlan({
      //     version: Number(parsedRaw.version || 1),
      //     goal: String(parsedRaw.goal || goal.trim()),
      //     changes,
      //     notes: parsedRaw.notes ? String(parsedRaw.notes) : undefined,
      //     research: Array.isArray(parsedRaw.research)
      //       ? parsedRaw.research
      //       : undefined,
      //   });
    } catch (e: any) {
      setError(e?.message || "Failed to generate plan");
    } finally {
      setIsBusy(false);
    }
  }, [
    goal,
    settings.baseUrl,
    settings.model,
    settings.openaiApiKey,
    docs,
    availableElements,
  ]);

  const clearAll = useCallback(() => {
    setPlan(null);
    setResearchFiles([]);
    setError(null);
  }, []);

  useImperativeHandle(ref, () => ({
    submit: (text: string) => {
      setGoal(text);
      // Default behavior: plan directly
      void requestPlan();
    },
    research: (text?: string) => {
      if (text) setGoal(text);
      void runResearch();
    },
    plan: (text?: string) => {
      if (text) setGoal(text);
      void requestPlan();
    },
  }));

  return (
    <div
      className="docs-chat-architect"
      style={{
        padding: "12px",
        borderTop: "1px solid #eee",
        borderBottom: "1px solid #eee",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 600 }}>Architect</div>
        {isBusy && <span className="status-thinking">Working...</span>}
        {error && <span style={{ color: "#c00" }}>❌ {error}</span>}
      </div>
      <div style={{ marginTop: 8 }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe what to build/change... Reference elements with @ like @myTask"
          rows={3}
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>
      <div
        style={{ marginTop: 8, display: "flex", gap: 8 }}
        className="architect-controls"
      >
        <button
          className="sidebar-header__action-btn"
          onClick={runResearch}
          disabled={isBusy || !goal.trim()}
          title="Research referenced elements via GraphQL"
        >
          🔎 Research
        </button>
        <button
          className="sidebar-header__action-btn"
          onClick={requestPlan}
          disabled={isBusy || !goal.trim()}
          title="Ask AI to generate a change plan (uses tools)"
        >
          🧠 Plan
        </button>
        <button
          className="sidebar-header__action-btn"
          onClick={clearAll}
          disabled={isBusy}
          title="Clear results"
        >
          ✨ Clear
        </button>
      </div>

      {researchFiles.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="architect-section-title" style={{ marginBottom: 6 }}>
            Research Files ({researchFiles.length})
          </div>
          <div className="architect-list">
            {researchFiles.map((f) => (
              <div key={f.id} className="architect-item">
                <div className="architect-item-meta">
                  <div className="id">{f.id}</div>
                  <div className="path">{f.filePath || "<no filePath>"}</div>
                </div>
                <div className="architect-item-actions">
                  {f.fileContents && (
                    <button
                      className="sidebar-header__action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFileModal(
                          {
                            fileName: f.filePath || f.id,
                            content: f.fileContents || "",
                            language: inferLanguageFromPath(f.filePath),
                          },
                          `Research: ${f.filePath || f.id}`
                        );
                      }}
                    >
                      👁️ View
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <div style={{ marginTop: 16 }}>
          <div className="architect-section-title">Plan</div>
          {plan.goal && (
            <div style={{ opacity: 0.8, marginTop: 4 }}>Goal: {plan.goal}</div>
          )}
          {plan.notes && (
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              Notes: {plan.notes}
            </div>
          )}
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {plan.changes.map((ch, idx) => {
              const lang = ch.language || inferLanguageFromPath(ch.path);
              const opNorm =
                ch.op === "add_file"
                  ? "create_file"
                  : ch.op === "change_file"
                  ? "update_file"
                  : ch.op;
              const header = `${idx + 1}. ${opNorm.replace("_", " ")}`;
              const fileName = ch.path;
              const canDiff =
                opNorm === "update_file" && ch.oldContent && ch.newContent;
              return (
                <div
                  key={`${opNorm}-${ch.path}-${idx}`}
                  className="chat-bubble"
                  style={{ border: "1px solid #eee" }}
                >
                  <div
                    className="chat-message-header"
                    style={{ marginBottom: 6 }}
                  >
                    <span className="chat-message-author">{header}</span>
                    <span className="chat-message-time">{fileName}</span>
                  </div>
                  {ch.description && (
                    <div className="message-text" style={{ marginBottom: 6 }}>
                      {ch.description}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {opNorm !== "create_file" && ch.oldContent && (
                      <button
                        className="sidebar-header__action-btn"
                        onClick={() =>
                          openFileModal(
                            {
                              fileName,
                              content: ch.oldContent || "",
                              language: lang,
                            },
                            `OLD: ${fileName}`
                          )
                        }
                      >
                        OLD
                      </button>
                    )}
                    {opNorm !== "delete_file" && ch.newContent && (
                      <button
                        className="sidebar-header__action-btn"
                        onClick={() =>
                          openFileModal(
                            {
                              fileName,
                              content: ch.newContent || "",
                              language: lang,
                            },
                            `NEW: ${fileName}`
                          )
                        }
                      >
                        NEW
                      </button>
                    )}
                    {canDiff && (
                      <button
                        className="sidebar-header__action-btn"
                        onClick={() =>
                          openDiffModal({
                            fileName,
                            previousVersion: ch.oldContent || "",
                            newVersion: ch.newContent || "",
                          })
                        }
                      >
                        DIFF
                      </button>
                    )}
                    {opNorm === "update_file" && ch.patch && (
                      <button
                        className="sidebar-header__action-btn"
                        onClick={() => openPatchModal(fileName, ch.patch!)}
                      >
                        PATCH
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CodeModal
        title={codeModal.title}
        subtitle={codeModal.subtitle}
        isOpen={codeModal.isOpen}
        onClose={closeModal}
        code={codeModal.content}
      />
    </div>
  );
});
