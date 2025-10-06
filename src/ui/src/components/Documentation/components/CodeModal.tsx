import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import "./CodeModal.scss";
import { graphqlRequest } from "../utils/graphqlClient";
import { copyToClipboard } from "./chat/ChatUtils";
import { CoverageVisualization, type CoverageData } from "./CoverageVisualization";

export interface CodeModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  code: string | null | undefined;
  enableEdit?: boolean;
  saveOnFile?: string | null;
  coverageData?: CoverageData | null;
  showCoverage?: boolean;
}

export const CodeModal: React.FC<CodeModalProps> = ({
  title,
  subtitle,
  isOpen,
  onClose,
  code,
  enableEdit = false,
  saveOnFile,
  coverageData,
  showCoverage = false,
}) => {
  // Always render the editor; track draft and last-saved baseline
  const [draft, setDraft] = useState<string>(code ?? "");
  const [baseline, setBaseline] = useState<string>(code ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const originalBodyStyle = useRef<{
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflowY: string;
  }>({
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    overflowY: "",
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (!isOpen) return;

    const lockedScrollY = window.scrollY || window.pageYOffset || 0;

    // Store original styles
    originalBodyStyle.current = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };

    // Robust scroll lock: prevent layout shift without padding hacks
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore original styles and scroll position
      document.body.style.position = originalBodyStyle.current.position;
      document.body.style.top = originalBodyStyle.current.top;
      document.body.style.left = originalBodyStyle.current.left;
      document.body.style.right = originalBodyStyle.current.right;
      document.body.style.width = originalBodyStyle.current.width;
      document.body.style.overflowY = originalBodyStyle.current.overflowY;
      window.scrollTo(0, lockedScrollY);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // When opening or when upstream code changes, reset draft and baseline
    const next = code ?? "";
    setDraft(next);
    setBaseline(next);
  }, [code, isOpen]);

  const canEdit =
    enableEdit && typeof saveOnFile === "string" && saveOnFile.length > 0;

  const onSave = useCallback(async () => {
    if (!canEdit || !saveOnFile) return;
    setIsSaving(true);
    setError(null);
    try {
      const mutation = `
        mutation EditFile($path: String!, $content: String!) {
          editFile(path: $path, content: $content) {
            success
            error
            path
            resolvedPath
          }
        }
      `;
      const result = await graphqlRequest<{
        editFile: { success: boolean; error?: string | null };
      }>(mutation, { path: saveOnFile, content: draft });
      if (!result.editFile?.success) {
        throw new Error(result.editFile?.error || "Unknown error while saving");
      }
      // Update baseline so Save hides until further edits
      setBaseline(draft);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, saveOnFile, draft]);

  const handleCopy = useCallback(async () => {
    const textToCopy = draft || "";
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [draft]);

  if (!isOpen) return null;

  return createPortal(
    <div className="code-modal__backdrop" onClick={onClose}>
      <div
        className="code-modal__dialog"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="code-modal__header">
          <div className="code-modal__titles">
            <h3 className="code-modal__title">{title}</h3>
            {subtitle && <div className="code-modal__subtitle">{subtitle}</div>}
          </div>
          <div className="code-modal__header-right">
            <div className="code-modal__esc-hint">Press ESC to Close</div>
            {canEdit && draft !== baseline && (
              <button
                className="code-modal__btn code-modal__btn--glass-primary"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? "SAVING..." : "SAVE"}
              </button>
            )}
            <button className="code-modal__close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="code-modal__content">
          {showCoverage && coverageData && (
            <div className="code-modal__coverage-section">
              <CoverageVisualization
                coverage={coverageData}
                filePath={subtitle}
                compact={false}
              />
            </div>
          )}

          <div
            className={`code-modal__editor-wrap${
              showCoverage ? " code-modal__editor-wrap--with-coverage" : ""
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDownCapture={(e) => {
              // Cmd/Ctrl+S to save when dirty
              const k = e.key;
              if ((e.metaKey || e.ctrlKey) && (k === "s" || k === "S")) {
                e.preventDefault();
                if (canEdit && draft !== baseline && !isSaving) onSave();
              }
            }}
          >
            <button
              className={`code-modal__copy-btn${
                copied ? " code-modal__copy-btn--copied" : ""
              }`}
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy to clipboard"}
              aria-label={copied ? "Copied" : "Copy code"}
            />
            <CodeMirror
              value={draft}
              onChange={(val) => {
                if (canEdit) {
                  setDraft(val);
                }
              }}
              extensions={[javascript({ typescript: true })]}
              theme={oneDark}
              editable={canEdit}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
              }}
              className="code-modal__editor"
              style={{ fontSize: "14px" }}
            />
          </div>
          {error && <div className="code-modal__error">{error}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
