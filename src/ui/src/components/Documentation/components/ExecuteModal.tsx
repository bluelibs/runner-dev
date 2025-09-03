import React from "react";
import { createPortal } from "react-dom";
import "./ExecuteModal.scss";
import {
  hasOpenAIKey,
  generateInstanceFromJsonSchema,
} from "./chat/ai.prefill";

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
  const [aiLoading, setAiLoading] = React.useState<boolean>(false);
  const [aiAvailable, setAiAvailable] = React.useState<boolean>(false);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const [formData, setFormData] = React.useState<Record<string, any>>({});

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
      if (isOpen) {
        console.log("ExecuteModal - resolved $ref schema:", {
          refPath,
          resolved,
        });
      }
      return resolved || null;
    }

    return schema;
  }, [schema, isOpen]);

  // Check if schema has renderable properties
  const hasFormFields = React.useMemo(() => {
    const result =
      resolvedSchema &&
      resolvedSchema.properties &&
      Object.keys(resolvedSchema.properties).length > 0 &&
      // Allow schemas without explicit type or with type "object"
      (!resolvedSchema.type || resolvedSchema.type === "object");
    if (isOpen) {
      console.log("ExecuteModal - hasFormFields check:", {
        schemaString,
        schema,
        resolvedSchema,
        hasFormFields: result,
        properties: resolvedSchema?.properties,
        schemaType: resolvedSchema?.type,
      });
    }
    return result;
  }, [resolvedSchema, schema, schemaString, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading) handleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, loading]);

  React.useEffect(() => {
    if (initialInputJson !== undefined) setInputJson(initialInputJson);
  }, [initialInputJson]);

  // Focus management & trap
  React.useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (container) {
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length > 0) focusable[0].focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = container
        ? Array.from(
            container.querySelectorAll<HTMLElement>(
              'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      try {
        previouslyFocused.current?.focus();
      } catch {}
    };
  }, [isOpen]);

  // Detect if AI key is configured
  React.useEffect(() => {
    setAiAvailable(hasOpenAIKey());
  }, [isOpen]);

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

  const handleAIPrefill = async () => {
    if (!schemaString || !resolvedSchema) return;
    setError(null);
    setAiLoading(true);
    try {
      const generated = await generateInstanceFromJsonSchema(schemaString);
      // Merge with defaults but prefer AI values
      const merged = { ...formData, ...(generated || {}) };
      setFormData(merged);
      setInputJson(JSON.stringify(merged, null, 2));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const renderFormField = (key: string, prop: any) => {
    const isRequired =
      resolvedSchema.required && resolvedSchema.required.includes(key);
    const value = formData[key] || "";

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

  const prepareInput = (raw: string) => {
    if (!evalInput) return raw;
    try {
      // Evaluate JS-like input on the client and return minified JSON
      // e.g. allow single-quoted strings or expressions
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${raw})`)();
      return JSON.stringify(value);
    } catch (e: any) {
      throw new Error(e?.message || String(e));
    }
  };

  const handleRun = async () => {
    setError(null);
    setResponse(null);
    setLoading(true);
    try {
      const prepared = prepareInput(inputJson);
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
  };

  // Lock background scroll and preserve position while modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const lockedScrollY = window.scrollY || window.pageYOffset || 0;
    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };

    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";

    return () => {
      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.left = original.left;
      document.body.style.right = original.right;
      document.body.style.width = original.width;
      document.body.style.overflowY = original.overflowY;
      window.scrollTo(0, lockedScrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="execute-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="execute-modal-title"
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="execute-modal__container"
        ref={containerRef}
        aria-busy={loading}
      >
        <div className="execute-modal__left">
          <div className="execute-modal__header">
            <div id="execute-modal-title" className="execute-modal__title">
              {title || "Execute"}
            </div>
            <div className="execute-modal__controls">
              <button
                className="btn execute-modal__ai-btn"
                title={
                  aiAvailable
                    ? "AI prefill based on schema"
                    : "AI key not configured in Chat settings"
                }
                onClick={handleAIPrefill}
                disabled={!aiAvailable || aiLoading || !schemaString}
              >
                {aiLoading ? "Filling…" : "✧ Prefill"}
              </button>
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
              <button className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

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
    </div>
  );

  // Render the overlay at the document.body level to avoid being constrained
  // by any parent stacking/transform contexts inside cards.
  return createPortal(modalContent, document.body);
};

export default ExecuteModal;
