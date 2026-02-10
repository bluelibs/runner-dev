import React, { useEffect, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { Extension } from "@codemirror/state";
import {
  ViewPlugin,
  DecorationSet,
  Decoration,
  ViewUpdate,
} from "@codemirror/view";
import { EditorView } from "@codemirror/view";
import "./CodeModal.scss";
import { graphqlRequest } from "../utils/graphqlClient";
import { copyToClipboard } from "./chat/ChatUtils";
import {
  CoverageVisualization,
  type CoverageData,
} from "./CoverageVisualization";
import type { LineCoverage } from "../../../../../resources/coverage.resource";
import { BaseModal } from "./modals";

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

// Create a CodeMirror extension for line coverage highlighting
function createLineCoverageExtension(lines: LineCoverage[]): Extension {
  const lineCoveragePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView): DecorationSet {
        const builder = [];

        lines.forEach((lineCoverage) => {
          const lineNum = lineCoverage.line; // CM6 doc.line() is 1-indexed
          if (lineNum >= 1 && lineNum <= view.state.doc.lines) {
            const from = view.state.doc.line(lineNum).from;

            const mark = Decoration.line({
              attributes: {
                class: lineCoverage.covered
                  ? "cm-coverage-line-covered"
                  : "cm-coverage-line-uncovered",
                title: `Line ${lineCoverage.line}: ${
                  lineCoverage.covered ? "covered" : "not covered"
                } (${lineCoverage.hits} hits)`,
              },
            });

            builder.push(mark.range(from));
          }
        });

        return Decoration.set(builder);
      }
    }
  );

  return [
    lineCoveragePlugin,
    EditorView.theme({
      ".cm-coverage-line-covered": {
        backgroundColor: "rgba(76, 175, 80, 0.15)",
        borderLeft: "3px solid #4caf50",
        position: "relative",

        "&::before": {
          content: '"✓"',
          position: "absolute",
          left: "-20px",
          top: "2px",
          color: "#4caf50",
          fontSize: "12px",
          fontWeight: "bold",
        },
      },

      ".cm-coverage-line-uncovered": {
        backgroundColor: "rgba(244, 67, 54, 0.15)",
        borderLeft: "3px solid #f44336",
        position: "relative",

        "&::before": {
          content: '"✗"',
          position: "absolute",
          left: "-20px",
          top: "2px",
          color: "#f44336",
          fontSize: "12px",
          fontWeight: "bold",
        },
      },

      // Add margin to line numbers to make space for coverage indicators
      ".cm-lineNumbers .cm-gutterElement": {
        paddingLeft: "25px",
      },

      // Custom gutter for coverage indicators
      ".cm-coverage-gutter": {
        width: "20px",
        color: "#666",
        fontSize: "12px",
        fontWeight: "bold",
        textAlign: "center",
        cursor: "pointer",

        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        },
      },
    }),
  ];
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
  // Track draft and last-saved baseline
  const [draft, setDraft] = useState<string>(code ?? "");
  const [baseline, setBaseline] = useState<string>(code ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // When opening or when upstream code changes, reset draft and baseline
    const next = code ?? "";
    setDraft(next);
    setBaseline(next);
  }, [code, isOpen]);

  const canEdit =
    enableEdit && typeof saveOnFile === "string" && saveOnFile.length > 0;

  // Prepare CodeMirror extensions based on coverage data
  const codeMirrorExtensions = React.useMemo(() => {
    const extensions = [javascript({ typescript: true })];

    // Add line coverage highlighting if coverage data is available
    if (showCoverage && coverageData?.lines) {
      extensions.push(createLineCoverageExtension(coverageData.lines));
    }

    return extensions;
  }, [showCoverage, coverageData?.lines]);

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

  // Custom header with save button and coverage legend
  const renderHeader = useCallback(
    ({ onClose: close }: { onClose: () => void }) => (
      <div className="code-modal__header">
        <div className="code-modal__titles">
          <h3 className="code-modal__title">{title}</h3>
          {subtitle && <div className="code-modal__subtitle">{subtitle}</div>}
          {showCoverage && coverageData?.lines && (
            <div className="code-modal__coverage-legend">
              <div className="legend-item legend--covered">
                Covered ({coverageData.lines.filter((l) => l.covered).length})
              </div>
              <div className="legend-item legend--uncovered">
                Uncovered ({coverageData.lines.filter((l) => !l.covered).length}
                )
              </div>
            </div>
          )}
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
          <button className="code-modal__close" onClick={close}>
            ×
          </button>
        </div>
      </div>
    ),
    [
      title,
      subtitle,
      showCoverage,
      coverageData,
      canEdit,
      draft,
      baseline,
      isSaving,
      onSave,
    ]
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="code-modal__dialog"
      renderHeader={renderHeader}
      ariaLabel={`Code viewer: ${title}`}
    >
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
            extensions={codeMirrorExtensions}
            theme={oneDark}
            editable={canEdit}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              dropCursor: false,
              allowMultipleSelections: false,
            }}
            className={`code-modal__editor${
              showCoverage && coverageData?.lines
                ? " code-modal__editor--with-coverage"
                : ""
            }`}
            style={{ fontSize: "14px" }}
          />
        </div>
        {error && <div className="code-modal__error">{error}</div>}
      </div>
    </BaseModal>
  );
};
