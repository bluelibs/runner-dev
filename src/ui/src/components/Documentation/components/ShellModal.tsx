import React from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
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
  SHELL_MUTATION,
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

export const ShellModal: React.FC<ShellModalProps> = ({
  isOpen,
  onClose,
  resourceId,
}) => {
  const [code, setCode] = React.useState<string>("");
  const [entries, setEntries] = React.useState<ShellEntry[]>([]);
  const [running, setRunning] = React.useState<boolean>(false);
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
    if (!snippet || running) return;

    const entry: ShellEntry = {
      id: ++shellEntryCounter,
      code: snippet,
      status: "pending",
      startedAt: Date.now(),
    };
    setEntries((prev) => [...prev, entry]);
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
  }, [code, resourceId, running]);

  // Enter always runs, Shift+Enter inserts a newline (Ctrl/Cmd+Enter also
  // runs), Tab accepts an open completion. Capture phase so we reach keys
  // before CodeMirror's own handlers (its Enter would insert a newline).
  const editorRef = React.useRef<ReactCodeMirrorRef>(null);
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
        !e.altKey &&
        editor.querySelector(".cm-tooltip-autocomplete")
      ) {
        const view = editorRef.current?.view;
        if (view && acceptCompletion(view)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [handleRun, isOpen]);

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
            disabled={running || code.trim().length === 0}
            title={running ? "Running..." : "Run snippet (Enter)"}
          >
            {running ? "Running..." : "Run"}
          </button>
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    ),
    [code, entries.length, handleClear, handleRun, resourceId, running, title]
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
      <div className="shell-modal__banner">
        <span className="shell-modal__banner-text">
          Expressions auto-return · <kbd>Enter</kbd> to run · <kbd>Shift</kbd>+
          <kbd>Enter</kbd> for a new line · <kbd>Tab</kbd> accepts a suggestion
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
            onChange={(val) => setCode(val)}
            extensions={editorExtensions}
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
