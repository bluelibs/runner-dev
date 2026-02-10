import React from "react";
import "./ExecuteModal.scss";
// [AI-CHAT-DISABLED] import {
//   hasOpenAIKey,
//   generateInstanceFromJsonSchema,
// } from "./chat/ai.prefill";
import { copyToClipboard } from "./chat/ChatUtils";
import { BaseModal } from "./modals";

export interface ExecuteModalProps {
  isOpen: boolean;
  title?: string;
  schemaString?: string | null;
  initialInputJson?: string;
  onClose: () => void;
  onInvoke: (args: { inputJson: string; evalInput: boolean }) => Promise<{
    output?: string;
    error?: string;
  }>;
}

export const ExecuteModal: React.FC<ExecuteModalProps> = ({
  isOpen,
  title,
  schemaString,
  initialInputJson,
  onClose,
  onInvoke,
}) => {
  const [inputJson, setInputJson] = React.useState<string>(
    initialInputJson ?? "{}"
  );
  const [evalInput, setEvalInput] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [response, setResponse] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // [AI-CHAT-DISABLED] const [aiLoading, setAiLoading] = React.useState<boolean>(false);
  // [AI-CHAT-DISABLED] const [aiAvailable, setAiAvailable] = React.useState<boolean>(false);
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [copiedPreview, setCopiedPreview] = React.useState<boolean>(false);

  // Parse schema for simple form building
  const schema = React.useMemo(() => {
    if (!schemaString) return null;
    try {
      return JSON.parse(schemaString);
    } catch (error) {
      if (isOpen) {
        console.error("ExecuteModal - failed to parse schema:", {
          schemaString,
          error,
        });
      }
      return null;
    }
  }, [schemaString, isOpen]);

  // Resolve schema references and get the actual schema to use
  const resolvedSchema = React.useMemo(() => {
    if (!schema) return null;

    // If schema has a $ref, resolve it
    if (schema.$ref && schema.definitions) {
      const refPath = schema.$ref.replace("#/definitions/", "");
      const resolved = schema.definitions[refPath];
      return resolved || null;
    }

    return schema;
  }, [schema]);

  // Check if schema has renderable properties
  const hasFormFields = React.useMemo(() => {
    const result =
      resolvedSchema &&
      resolvedSchema.properties &&
      Object.keys(resolvedSchema.properties).length > 0 &&
      // Allow schemas without explicit type or with type "object"
      (!resolvedSchema.type || resolvedSchema.type === "object");

    return result;
  }, [resolvedSchema]);

  const handleRun = React.useCallback(async () => {
    setError(null);
    setResponse(null);
    setLoading(true);
    try {
      let prepared = inputJson;
      if (evalInput) {
        try {
          // Evaluate JS-like input on the client and return minified JSON
          // e.g. allow single-quoted strings or expressions
          const value = Function(`"use strict"; return (${inputJson})`)();
          prepared = JSON.stringify(value);
        } catch (e: any) {
          throw new Error(e?.message || String(e));
        }
      }

      const result = await onInvoke({ inputJson: prepared, evalInput: false });
      if (result.error) {
        setError(result.error);
      } else if (result.output) {
        // Try to parse and prettify JSON response, otherwise show raw
        try {
          const parsed = JSON.parse(result.output);
          setResponse(JSON.stringify(parsed, null, 2));
        } catch {
          setResponse(result.output);
        }
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [evalInput, inputJson, onInvoke]);

  // Ctrl/Cmd+Enter to run (Escape handled by ModalStack)
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading) handleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun, isOpen, loading]);

  React.useEffect(() => {
    if (initialInputJson !== undefined) setInputJson(initialInputJson);
  }, [initialInputJson]);

  // [AI-CHAT-DISABLED] Detect if AI key is configured
  // React.useEffect(() => {
  //   setAiAvailable(hasOpenAIKey());
  // }, [isOpen]);

  // Initialize form data from schema defaults
  React.useEffect(() => {
    if (resolvedSchema && resolvedSchema.properties) {
      const defaults: Record<string, any> = {};
      Object.entries(resolvedSchema.properties).forEach(
        ([key, prop]: [string, any]) => {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          } else {
            switch (prop.type) {
              case "string":
                defaults[key] = "";
                break;
              case "number":
              case "integer":
                defaults[key] = 0;
                break;
              case "boolean":
                defaults[key] = false;
                break;
              case "array":
                defaults[key] = [];
                break;
              default:
                defaults[key] = "";
            }
          }
        }
      );
      setFormData(defaults);
    }
  }, [resolvedSchema]);

  // Update JSON when form data changes
  React.useEffect(() => {
    if (hasFormFields && Object.keys(formData).length > 0) {
      setInputJson(JSON.stringify(formData, null, 2));
    }
  }, [formData, hasFormFields]);

  const handleFormFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // [AI-CHAT-DISABLED] AI prefill handler
  // const handleAIPrefill = async () => {
  //   if (!schemaString || !resolvedSchema) return;
  //   setError(null);
  //   setAiLoading(true);
  //   try {
  //     const generated = await generateInstanceFromJsonSchema(schemaString);
  //     const merged = { ...formData, ...(generated || {}) };
  //     setFormData(merged);
  //     setInputJson(JSON.stringify(merged, null, 2));
  //   } catch (e: any) {
  //     setError(e?.message || String(e));
  //   } finally {
  //     setAiLoading(false);
  //   }
  // };

  const renderFormField = (key: string, prop: any) => {
    const isRequired =
      resolvedSchema.required && resolvedSchema.required.includes(key);
    const value = formData[key] ?? "";

    if (prop.enum && Array.isArray(prop.enum)) {
      return (
        <div key={key} className="execute-modal__field">
          <label className="execute-modal__label">
            {prop.title || key}
            {isRequired ? " *" : ""}
          </label>
          <select
            className="execute-modal__select"
            value={value}
            onChange={(e) => handleFormFieldChange(key, e.target.value)}
          >
            {prop.enum.map((option: any) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    switch (prop.type) {
      case "boolean":
        return (
          <div key={key} className="execute-modal__field">
            <label className="execute-modal__label execute-modal__checkbox-label">
              <input
                type="checkbox"
                className="execute-modal__checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleFormFieldChange(key, e.target.checked)}
              />
              {prop.title || key}
              {isRequired ? " *" : ""}
            </label>
          </div>
        );
      case "number":
      case "integer":
        return (
          <div key={key} className="execute-modal__field">
            <label className="execute-modal__label">
              {prop.title || key}
              {isRequired ? " *" : ""}
            </label>
            <input
              type="number"
              className="execute-modal__input"
              value={value}
              step={prop.type === "integer" ? 1 : "any"}
              placeholder={prop.description}
              onChange={(e) =>
                handleFormFieldChange(
                  key,
                  e.target.value ? Number(e.target.value) : ""
                )
              }
            />
          </div>
        );
      default: // string
        return (
          <div key={key} className="execute-modal__field">
            <label className="execute-modal__label">
              {prop.title || key}
              {isRequired ? " *" : ""}
            </label>
            <input
              type="text"
              className="execute-modal__input"
              value={value}
              placeholder={prop.description}
              onChange={(e) => handleFormFieldChange(key, e.target.value)}
            />
          </div>
        );
    }
  };

  // Scroll lock handled by BaseModal

  const renderHeader = React.useCallback(
    ({ onClose: close }: { onClose: () => void }) => (
      <div className="execute-modal__header">
        <div id="execute-modal-title" className="execute-modal__title">
          {title || "Execute"}
        </div>
        <div className="execute-modal__controls">
          {/* [AI-CHAT-DISABLED] AI Prefill button
          {resolvedSchema && (
            <button
              className="btn execute-modal__ai-btn"
              title={
                aiAvailable
                  ? "AI prefill based on schema"
                  : "AI key not configured in Chat settings"
              }
              onClick={handleAIPrefill}
              disabled={!aiAvailable || aiLoading}
            >
              {aiLoading ? "Filling\u2026" : "\u2727 Prefill"}
            </button>
          )}
          */}
          <label className="execute-modal__eval">
            <input
              type="checkbox"
              checked={evalInput}
              onChange={(e) => setEvalInput(e.target.checked)}
            />
            Eval input
          </label>
          <button
            className={`btn btn-primary ${
              loading ? "execute-modal__loading" : ""
            }`}
            onClick={handleRun}
            disabled={loading}
            title={loading ? "Running..." : "Run task (Ctrl+Enter)"}
          >
            {loading ? "Running..." : "Run"}
          </button>
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    ),
    [title, evalInput, loading, handleRun]
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="execute-modal__container"
      renderHeader={renderHeader}
      ariaLabel={`Execute: ${title || "task"}`}
    >
      <div className="execute-modal__split">
        <div className="execute-modal__left">
          <div className="execute-modal__body">
            {hasFormFields ? (
              <div className="execute-modal__form-layout">
                <div className="execute-modal__form-section">
                  <div className="execute-modal__section-header">
                    <span className="execute-modal__section-title">Form</span>
                  </div>
                  <div className="execute-modal__form">
                    {resolvedSchema &&
                      resolvedSchema.properties &&
                      Object.entries(resolvedSchema.properties).map(
                        ([key, prop]: [string, any]) =>
                          renderFormField(key, prop)
                      )}
                  </div>
                </div>
                <div className="execute-modal__json-preview">
                  <div className="execute-modal__section-header">
                    <span className="execute-modal__section-title">
                      JSON Preview
                    </span>
                    <button
                      className={`execute-modal__copy-btn${
                        copiedPreview ? " execute-modal__copy-btn--copied" : ""
                      }`}
                      onClick={async () => {
                        const ok = await copyToClipboard(inputJson || "");
                        if (ok) {
                          setCopiedPreview(true);
                          setTimeout(() => setCopiedPreview(false), 1200);
                        }
                      }}
                      title={copiedPreview ? "Copied!" : "Copy JSON"}
                      aria-label={copiedPreview ? "Copied" : "Copy JSON"}
                      type="button"
                    />
                  </div>
                  <textarea
                    className="execute-modal__textarea execute-modal__textarea--preview"
                    value={inputJson}
                    onChange={(e) => setInputJson(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (!loading) handleRun();
                      }
                    }}
                    spellCheck={false}
                    placeholder="JSON will appear here as you fill the form..."
                  />
                </div>
              </div>
            ) : (
              <div className="execute-modal__json-only">
                <div className="execute-modal__section-header">
                  <span className="execute-modal__section-title">
                    Input JSON
                  </span>
                  {schemaString && (
                    <div className="execute-modal__schema-hint">
                      <span
                        title={`Schema: ${schemaString.slice(0, 100)}${
                          schemaString.length > 100 ? "..." : ""
                        }`}
                      >
                        📋
                      </span>
                    </div>
                  )}
                </div>
                <textarea
                  className="execute-modal__textarea"
                  value={inputJson}
                  onChange={(e) => setInputJson(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (!loading) handleRun();
                    }
                  }}
                  spellCheck={false}
                  placeholder="Enter JSON input..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="execute-modal__right">
          <div className="execute-modal__response-header">Response</div>
          <div className="execute-modal__response-body" tabIndex={0}>
            {loading ? (
              <div className="execute-modal__response-loading">
                Running task...
              </div>
            ) : (
              <>
                {error && <pre className="execute-modal__error">{error}</pre>}
                {response && (
                  <pre className="execute-modal__code">{response}</pre>
                )}
                {!response && !error && (
                  <div className="execute-modal__empty">No response yet</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default ExecuteModal;
