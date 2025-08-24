import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/plugins/line-numbers/prism-line-numbers";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "prismjs/themes/prism-tomorrow.css";
import "./CodeModal.scss";
import { graphqlRequest } from "../utils/graphqlClient";

export interface CodeModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  code: string | null | undefined;
  enableEdit?: boolean;
  saveOnFile?: string | null;
}

export const CodeModal: React.FC<CodeModalProps> = ({
  title,
  subtitle,
  isOpen,
  onClose,
  code,
  enableEdit = false,
  saveOnFile,
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(code ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (isOpen && codeRef.current && code && !isEditing) {
      Prism.highlightElement(codeRef.current);
    }
  }, [isOpen, code, isEditing]);

  useEffect(() => {
    setDraft(code ?? "");
  }, [code, isOpen]);

  const canEdit =
    enableEdit && typeof saveOnFile === "string" && saveOnFile.length > 0;

  const onStartEdit = useCallback(() => {
    if (!canEdit) return;
    setIsEditing(true);
    setError(null);
  }, [canEdit]);

  const onCancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft(code ?? "");
    setError(null);
  }, [code]);

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
      setIsEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, saveOnFile, draft]);

  const highlight = useCallback(
    (src: string) =>
      Prism.highlight(src, Prism.languages.typescript, "typescript"),
    []
  );

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
            {canEdit && !isEditing && (
              <button
                className="code-modal__btn code-modal__btn--glass"
                onClick={onStartEdit}
              >
                EDIT
              </button>
            )}
            {isEditing && (
              <>
                <button
                  className="code-modal__btn code-modal__btn--glass-primary"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {isSaving ? "SAVING..." : "SAVE"}
                </button>
                <button
                  className="code-modal__btn code-modal__btn--glass"
                  onClick={onCancelEdit}
                  disabled={isSaving}
                >
                  CANCEL
                </button>
              </>
            )}
            <button className="code-modal__close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="code-modal__content">
          {!enableEdit || !isEditing ? (
            <pre className="code-modal__pre line-numbers">
              <code ref={codeRef} className="language-typescript">
                {code ?? "No content"}
              </code>
            </pre>
          ) : (
            <Editor
              value={draft}
              onValueChange={setDraft}
              highlight={highlight}
              padding={16}
              className="code-modal__editor"
              preClassName="code-modal__editor-pre language-typescript"
              textareaClassName="code-modal__editor-textarea"
              style={{ overflow: "auto", minHeight: 400 }}
            />
          )}
          {error && <div className="code-modal__error">{error}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
};
