import React from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  acceptCompletion,
  autocompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  javascript,
  localCompletionSource,
  snippets as javascriptSnippets,
} from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import "./ShellModal.scss";
import { copyToClipboard } from "./chat/ChatUtils";
import { BaseModal } from "./modals";
import {
  graphqlRequest,
  SHELL_ENABLED_QUERY,
  SHELL_MUTATION,
  type ShellEnabledResult,
  type ShellMutationResult,
} from "../utils/graphqlClient";
import { createShellCompletionSource } from "../utils/shellCompletion";

export interface ShellModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, `r` is bound to this resource's initialized value. */
  resourceId: string | null;
}

type ShellEntryStatus = "pending" | "done" | "error";

interface ShellEntry {
  id: number;
  code: string;
  status: ShellEntryStatus;
  result?: string | null;
  error?: string | null;
  logs?: string[];
  executionTimeMs?: number | null;
  startedAt: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatClockTime(at: number): string {
  return new Date(at).toLocaleTimeString();
}

function buildExamples(resourceId: string | null): string[] {
  if (resourceId) {
    return [
      "r",
      "Object.keys(r ?? {})",
      `runtime.getResourceConfig("${resourceId}")`,
      "await runtime.getHealth()",
    ];
  }
  return [
    "runtime.state",
    "runtime.root.id",
    "store.tasks.size",
    "await runtime.getHealth()",
  ];
}

let shellEntryCounter = 0;

/**
 * Whether the cursor sits on the editor edge in the given direction, so
 * Up/Down can browse history instead of moving the caret. Unknown shapes
 * (tests) and single-line editors always allow history.
 */
function isHistoryEdge(
  view: { state?: unknown } | null | undefined,
  direction: -1 | 1
): boolean {
  const state = view?.state as
    | {
        doc?: { lines: number; lineAt: (pos: number) => { number: number } };
        selection?: { main?: { head?: number } };
      }
    | undefined;
  const doc = state?.doc;
  const head = state?.selection?.main?.head;
  if (!doc || typeof head !== "number" || doc.lines <= 1) return true;
  const line = doc.lineAt(head).number;
  return direction < 0 ? line === 1 : line === doc.lines;
}

export const ShellModal: React.FC<ShellModalProps> = ({
  isOpen,
  onClose,
  resourceId,
}) => {
  const [code, setCode] = React.useState<string>("");
  const [entries, setEntries] = React.useState<ShellEntry[]>([]);
  const [running, setRunning] = React.useState<boolean>(false);
  // Tri-state: null while the server gate is unknown (assume enabled so the
  // UI never flashes a disabled state on slow networks), then the real value.
  const [shellEnabled, setShellEnabled] = React.useState<boolean | null>(null);
  const isShellDisabled = shellEnabled === false;
  const [copiedEntryId, setCopiedEntryId] = React.useState<number | null>(null);
  const transcriptRef = React.useRef<HTMLDivElement>(null);
  const editorWrapRef = React.useRef<HTMLDivElement>(null);

  // Focus the input on open. Deferred so it wins over the modal's own
  // focus-first-element pass, which runs after child effects.
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      editorWrapRef.current
        ?.querySelector<HTMLElement>(".cm-content")
        ?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  const stickToBottomRef = React.useRef<boolean>(true);
  const cancelledRef = React.useRef<boolean>(false);
  // Ticker state: re-renders the transcript while a run is pending so the
  // elapsed time stays live.
  const [, setTick] = React.useState<number>(0);

  const examples = React.useMemo(() => buildExamples(resourceId), [resourceId]);

  // Stable editor extensions: scope-aware server completions plus the default
  // JavaScript locals/snippets, opening as you type. The resource id flows
  // through a ref so typing never reconfigures the editor.
  const resourceIdRef = React.useRef<string | null>(resourceId);
  React.useEffect(() => {
    resourceIdRef.current = resourceId;
  }, [resourceId]);
  const editorExtensions = React.useMemo(
    () => [
      javascript({ typescript: true }),
      autocompletion({
        activateOnTyping: true,
        override: [
          createShellCompletionSource(() => resourceIdRef.current),
          localCompletionSource,
          javascriptSnippets,
        ],
      }),
    ],
    []
  );

  const title = resourceId ? `Shell — ${resourceId}` : "Shell — Runtime";

  // Surface the server-side shell gate up front so users don't discover it
  // by sending a snippet. Failures keep the optimistic state; the mutation
  // surfaces the real error if a run is attempted.
  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setShellEnabled(null);
    void (async () => {
      try {
        const response = await graphqlRequest<ShellEnabledResult>(
          SHELL_ENABLED_QUERY
        );
        if (!cancelled) setShellEnabled(response?.shellEnabled ?? true);
      } catch {
        if (!cancelled) setShellEnabled(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !running) return;
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 100);
    return () => window.clearInterval(timer);
  }, [isOpen, running]);

  const scrollTranscriptToBottom = React.useCallback(() => {
    const transcript = transcriptRef.current;
    if (transcript && stickToBottomRef.current) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, []);

  React.useEffect(() => {
    scrollTranscriptToBottom();
  }, [entries, running, scrollTranscriptToBottom]);

  const handleTranscriptScroll = React.useCallback(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const distanceFromBottom =
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 48;
  }, []);

  const handleRun = React.useCallback(async () => {
    const snippet = code.trim();
    if (!snippet || running || isShellDisabled) return;

    const entry: ShellEntry = {
      id: ++shellEntryCounter,
      code: snippet,
      status: "pending",
      startedAt: Date.now(),
    };
    setEntries((prev) => [...prev, entry]);
    historyRef.current = [...historyRef.current, snippet];
    historyIndexRef.current = null;
    setCode("");
    setRunning(true);
    stickToBottomRef.current = true;

    try {
      const response = await graphqlRequest<ShellMutationResult>(
        SHELL_MUTATION,
        { code: snippet, resourceId }
      );
      if (cancelledRef.current) return;
      const shell = response.shell;
      setEntries((prev) =>
        prev.map((item) =>
          item.id !== entry.id
            ? item
            : {
                ...item,
                status: shell.success ? "done" : "error",
                result: shell.result ?? null,
                error: shell.error ?? null,
                logs: (shell.logs ?? []).filter(
                  (line): line is string => line !== null
                ),
                executionTimeMs: shell.executionTimeMs ?? null,
              }
        )
      );
    } catch (e: unknown) {
      if (cancelledRef.current) return;
      const message = e instanceof Error ? e.message : String(e);
      setEntries((prev) =>
        prev.map((item) =>
          item.id !== entry.id
            ? item
            : { ...item, status: "error", error: message }
        )
      );
    } finally {
      if (!cancelledRef.current) {
        setRunning(false);
      }
    }
  }, [code, resourceId, running, isShellDisabled]);

  // Submitted snippets, oldest first. Independent from the transcript so
  // clearing entries never wipes recall. Navigation state: null when the
  // editor shows the live draft, otherwise the recalled history index.
  const editorRef = React.useRef<ReactCodeMirrorRef>(null);
  const historyRef = React.useRef<string[]>([]);
  const historyIndexRef = React.useRef<number | null>(null);
  const historyDraftRef = React.useRef<string>("");
  // Navigation writes count: lets onChange tell programmatic history
  // recalls (keep position) apart from manual edits (reset position).
  const historyNavWritesRef = React.useRef<number>(0);

  const replaceEditorText = React.useCallback((text: string) => {
    const view = editorRef.current?.view as
      | {
          dispatch?: (spec: unknown) => void;
          state?: { doc?: { length?: number } };
        }
      | undefined;
    if (typeof view?.dispatch === "function") {
      historyNavWritesRef.current += 1;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state?.doc?.length ?? text.length,
          insert: text,
        },
        selection: { anchor: text.length },
      });
    }
    setCode(text);
  }, []);

  const navigateHistory = React.useCallback(
    (direction: -1 | 1): boolean => {
      const history = historyRef.current;
      if (history.length === 0) return false;
      let index = historyIndexRef.current;
      if (index === null) {
        if (direction > 0) return false;
        historyDraftRef.current = code;
        index = history.length;
      }
      index += direction;
      if (index < 0) index = 0;
      if (index >= history.length) {
        historyIndexRef.current = null;
        replaceEditorText(historyDraftRef.current);
        return true;
      }
      historyIndexRef.current = index;
      replaceEditorText(history[index]);
      return true;
    },
    [code, replaceEditorText]
  );

  const handleEditorChange = React.useCallback((value: string) => {
    if (historyNavWritesRef.current > 0) {
      historyNavWritesRef.current -= 1;
    } else {
      historyIndexRef.current = null;
    }
    setCode(value);
  }, []);

  // Enter always runs, Shift+Enter inserts a newline (Ctrl/Cmd+Enter also
  // runs), Tab accepts an open completion or opens one, Up/Down browse
  // history at the editor edges. Capture phase so we reach keys before
  // CodeMirror's own handlers (its Enter would insert a newline, its Tab
  // would indent).
  React.useEffect(() => {
    historyIndexRef.current = null;
  }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
        return;
      }
      const target = e.target as HTMLElement | null;
      const editor =
        target && typeof target.closest === "function"
          ? target.closest(".shell-modal__editor")
          : null;
      if (!editor) return;
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRun();
        return;
      }
      if (
        e.key === "Tab" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // Tab always means completion in the shell: accept the open
        // suggestion, or open suggestions when there is no tooltip (after
        // deleting, dismissing, or before the server roundtrip lands).
        // Never fall through to indent: spaces here only corrupt snippets.
        const view = editorRef.current?.view;
        if (!view) return;
        e.preventDefault();
        e.stopPropagation();
        if (editor.querySelector(".cm-tooltip-autocomplete")) {
          if (!acceptCompletion(view)) {
            // Visible list but nothing accepted (stale state): refresh
            // instead of leaving Tab a dead key.
            startCompletion(view);
          }
          return;
        }
        startCompletion(view);
      }
      if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // History at the editor edges; otherwise the caret moves within
        // a multiline snippet. A completion list owns the arrows while
        // it is open (moving the selection).
        const direction = e.key === "ArrowUp" ? -1 : 1;
        if (
          !editor.querySelector(".cm-tooltip-autocomplete") &&
          isHistoryEdge(editorRef.current?.view, direction) &&
          navigateHistory(direction)
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [handleRun, navigateHistory, isOpen]);

  const handleCopyEntry = React.useCallback(async (entryToCopy: ShellEntry) => {
    const text =
      entryToCopy.status === "error"
        ? entryToCopy.error ?? ""
        : entryToCopy.result ?? "";
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedEntryId(entryToCopy.id);
      window.setTimeout(() => {
        setCopiedEntryId((current) =>
          current === entryToCopy.id ? null : current
        );
      }, 1200);
    }
  }, []);

  const handleClear = React.useCallback(() => {
    setEntries([]);
  }, []);

  const renderHeader = React.useCallback(
    ({ onClose: close }: { onClose: () => void }) => (
      <div className="shell-modal__header">
        <div className="shell-modal__titles">
          <div id="shell-modal-title" className="shell-modal__title">
            <span className="shell-modal__prompt" aria-hidden="true">
              &gt;_
            </span>
            {title}
          </div>
          <div className="shell-modal__chips">
            <span
              className="shell-modal__chip shell-modal__chip--r"
              title={
                resourceId
                  ? `Initialized value of ${resourceId}`
                  : "No resource scope (null)"
              }
            >
              r{resourceId ? `: ${resourceId}` : ": null"}
            </span>
            <span
              className="shell-modal__chip"
              title="Live Runner runtime: runTask, emitEvent, getResourceValue, getResourceConfig, getHealth…"
            >
              runtime
            </span>
          </div>
        </div>
        <div className="shell-modal__controls">
          {entries.length > 0 && (
            <button
              className="btn shell-modal__clear-btn"
              onClick={handleClear}
              disabled={running}
              title="Clear transcript"
            >
              Clear
            </button>
          )}
          <button
            className={`btn btn-primary ${
              running ? "shell-modal__loading" : ""
            }`}
            onClick={handleRun}
            disabled={running || code.trim().length === 0 || isShellDisabled}
            title={
              isShellDisabled
                ? "Shell is disabled in this environment"
                : running
                ? "Running..."
                : "Run snippet (Enter)"
            }
          >
            {running ? "Running..." : "Run"}
          </button>
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    ),
    [
      code,
      entries.length,
      handleClear,
      handleRun,
      isShellDisabled,
      resourceId,
      running,
      title,
    ]
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="shell-modal__container"
      renderHeader={renderHeader}
      ariaLabel={title}
    >
      {isShellDisabled && (
        <div className="shell-modal__disabled-note" role="status">
          Shell is disabled on this server. Start it with{" "}
          <code>RUNNER_DEV_EVAL=1</code> or <code>NODE_ENV=development</code> to
          enable it.
        </div>
      )}
      <div className="shell-modal__banner">
        <span className="shell-modal__banner-text">
          Expressions auto-return · <kbd>Enter</kbd> to run · <kbd>Shift</kbd>+
          <kbd>Enter</kbd> for a new line · <kbd>Tab</kbd> suggests & accepts ·{" "}
          <kbd>↑</kbd> <kbd>↓</kbd> history
        </span>
        <div className="shell-modal__examples">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="shell-modal__example"
              title={`Insert: ${example}`}
              onClick={() => setCode(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={transcriptRef}
        className="shell-modal__transcript"
        onScroll={handleTranscriptScroll}
        tabIndex={0}
        aria-label="Shell transcript"
      >
        {entries.length === 0 && (
          <div className="shell-modal__empty">
            <span className="shell-modal__prompt" aria-hidden="true">
              &gt;_
            </span>
            <span>
              {resourceId
                ? `Connected. r is the live value of ${resourceId}.`
                : "Connected. runtime is the live Runner runtime."}{" "}
              Type a snippet below to begin.
            </span>
          </div>
        )}
        {entries.map((entry) => (
          <article key={entry.id} className="shell-modal__entry">
            <div className="shell-modal__entry-code">
              <span className="shell-modal__prompt" aria-hidden="true">
                ›
              </span>
              <pre>{entry.code}</pre>
            </div>
            {entry.status === "pending" ? (
              <div className="shell-modal__entry-pending">
                <span className="shell-modal__spinner" aria-hidden="true" />
                Running… {formatDuration(Date.now() - entry.startedAt)}
              </div>
            ) : (
              <>
                {entry.logs && entry.logs.length > 0 && (
                  <pre className="shell-modal__entry-logs">
                    {entry.logs.join("\n")}
                  </pre>
                )}
                {entry.status === "error" ? (
                  <pre className="shell-modal__entry-error">
                    {entry.error || "Unknown error"}
                  </pre>
                ) : (
                  <pre className="shell-modal__entry-result">
                    {entry.result ?? ""}
                  </pre>
                )}
                <div className="shell-modal__entry-meta">
                  <span>
                    {entry.executionTimeMs !== null &&
                    entry.executionTimeMs !== undefined
                      ? formatDuration(entry.executionTimeMs)
                      : formatDuration(Date.now() - entry.startedAt)}{" "}
                    · {formatClockTime(entry.startedAt)}
                  </span>
                  <span className="shell-modal__entry-actions">
                    <button
                      type="button"
                      className="shell-modal__entry-action"
                      onClick={() => setCode(entry.code)}
                      title="Restore snippet to the editor"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="shell-modal__entry-action"
                      onClick={() => handleCopyEntry(entry)}
                      title={
                        copiedEntryId === entry.id ? "Copied!" : "Copy output"
                      }
                    >
                      {copiedEntryId === entry.id ? "Copied" : "Copy"}
                    </button>
                  </span>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      <div className="shell-modal__editor">
        <span className="shell-modal__prompt" aria-hidden="true">
          ›
        </span>
        <div
          ref={editorWrapRef}
          className="shell-modal__editor-wrap"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <CodeMirror
            ref={editorRef}
            value={code}
            onChange={handleEditorChange}
            extensions={editorExtensions}
            editable={!isShellDisabled}
            theme={oneDark}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              highlightActiveLine: false,
              autocompletion: false,
            }}
            className="shell-modal__codemirror"
            maxHeight="160px"
            placeholder="r // expressions auto-return, await supported"
          />
        </div>
      </div>
    </BaseModal>
  );
};

export default ShellModal;
