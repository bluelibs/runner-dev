import React from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormGroup,
  TextInput,
  Select,
  Checkbox,
} from "./common/FormControls";
import { formatSchema } from "../utils/formatting";
import { copyToClipboard } from "./chat/ChatUtils";
import JsonViewer from "./JsonViewer";
import "./SchemaRenderer.scss";
import {
  computeSchemaDefaultValue,
  type JsonSchemaLike,
} from "../utils/schemaDefaults";
import {
  getSchemaArrayEnumOptions,
  getSchemaFieldHint,
  getSchemaStringInputType,
  parseCommaSeparatedArrayValue,
} from "../utils/schemaForm";
// [AI-CHAT-DISABLED] import {
//   hasOpenAIKey,
//   generateInstanceFromJsonSchema,
// } from "./chat/ai.prefill";

export interface SchemaRendererProps {
  schemaString?: string | null;
  onJsonChange?: (jsonString: string, data: any) => void;
  hidePrint?: boolean;
}

type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: (string | number | boolean | null)[];
  default?: any;
  required?: string[];
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
};

function parseSchema(schemaString?: string | null): JsonSchema | null {
  if (!schemaString) return null;
  try {
    return JSON.parse(schemaString);
  } catch {
    return null;
  }
}

function computeDefaults(schema: JsonSchema | null): any {
  if (!schema) return undefined;
  return computeSchemaDefaultValue(schema as JsonSchemaLike);
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveRefInDocument(
  docRoot: JsonSchema | null,
  ref?: string
): JsonSchema | null {
  if (!docRoot || !ref) return null;
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/").map(decodePointerSegment);
  let node: any = docRoot;
  for (const key of parts) {
    if (node && typeof node === "object" && key in node) {
      node = node[key];
    } else {
      return null;
    }
  }
  return node as JsonSchema;
}

function derefLocal(
  fragment: JsonSchema | undefined,
  docRoot: JsonSchema | null
): JsonSchema | undefined {
  if (!fragment) return fragment;
  if (fragment.$ref) {
    const resolved = resolveRefInDocument(docRoot, fragment.$ref);
    if (resolved) return resolved;
  }
  return fragment;
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({
  schemaString,
  onJsonChange,
  hidePrint,
}) => {
  const [activeTab, setActiveTab] = React.useState<"print" | "form" | "json">(
    "json"
  );
  const [didPrefill, setDidPrefill] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  // [AI-CHAT-DISABLED] const [aiLoading, setAiLoading] = React.useState(false);
  // [AI-CHAT-DISABLED] const [aiAvailable, setAiAvailable] = React.useState(false);
  const schema = React.useMemo(() => parseSchema(schemaString), [schemaString]);
  const resolvedRoot = React.useMemo(
    () =>
      schema?.$ref
        ? resolveRefInDocument(schema, schema.$ref) || schema
        : schema,
    [schema]
  );
  const defaultValues = React.useMemo(
    () => computeDefaults(resolvedRoot),
    [resolvedRoot]
  );

  const {
    register,
    control: _control,
    watch,
    setValue,
    reset,
  } = useForm({
    defaultValues: defaultValues ?? {},
  });

  const formData = watch();

  const getPathValue = (obj: any, dotPath: string): any => {
    if (!obj) return undefined;
    if (!dotPath) return obj;
    return dotPath
      .split(".")
      .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  };

  const renderField = (
    name: string,
    fieldSchema: JsonSchema,
    path: string[] = [],
    parentRequired?: string[]
  ): React.ReactNode => {
    const effective = derefLocal(fieldSchema, schema) || fieldSchema;
    const fullName = [...path, name].join(".");
    const label = effective.title || name;
    const isRequired = Boolean(parentRequired && parentRequired.includes(name));

    if (effective.enum && effective.enum.length > 0) {
      return (
        <FormGroup key={fullName} label={`${label}${isRequired ? " *" : ""}`}>
          <Select {...register(fullName)}>
            {effective.enum.map((opt, idx) => (
              <option key={idx} value={String(opt)}>
                {String(opt)}
              </option>
            ))}
          </Select>
        </FormGroup>
      );
    }

    switch (effective.type) {
      case "string":
        return (
          <FormGroup
            key={fullName}
            label={`${label}${isRequired ? " *" : ""}`}
            hint={getSchemaFieldHint(effective)}
          >
            <TextInput
              type={getSchemaStringInputType(effective)}
              value={getPathValue(formData, fullName) ?? ""}
              onChange={(e) =>
                setValue(fullName as any, e.target.value, {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
              placeholder={effective.description || label}
            />
          </FormGroup>
        );
      case "number":
      case "integer":
        return (
          <FormGroup
            key={fullName}
            label={`${label}${isRequired ? " *" : ""}`}
            hint={getSchemaFieldHint(effective)}
          >
            <TextInput
              type="number"
              step={effective.type === "integer" ? 1 : "any"}
              value={getPathValue(formData, fullName) ?? ""}
              onChange={(e) => {
                const v =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setValue(fullName as any, v, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
            />
          </FormGroup>
        );
      case "boolean":
        return (
          <FormGroup key={fullName} label={`${label}${isRequired ? " *" : ""}`}>
            <Checkbox
              checked={Boolean(getPathValue(formData, fullName))}
              onChange={(e) =>
                setValue(fullName as any, e.target.checked, {
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
            />
          </FormGroup>
        );
      case "array": {
        // Simple arrays displayed as a comma-separated string for now
        const itemsResolved = derefLocal(effective.items, schema);
        const enumOptions = getSchemaArrayEnumOptions({
          ...effective,
          items: itemsResolved,
        });

        if (enumOptions) {
          return (
            <FormGroup
              key={fullName}
              label={`${label}${isRequired ? " *" : ""}`}
              hint="Select one or more options."
            >
              <Select
                multiple
                size={Math.min(Math.max(enumOptions.length, 3), 6)}
                value={
                  Array.isArray(getPathValue(formData, fullName))
                    ? getPathValue(formData, fullName)
                    : []
                }
                onChange={(e) => {
                  const selectedValues = Array.from(
                    e.target.selectedOptions,
                    (option) => option.value
                  );

                  setValue(fullName as any, selectedValues, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
              >
                {enumOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormGroup>
          );
        }

        return (
          <FormGroup
            key={fullName}
            label={`${label}${isRequired ? " *" : ""}`}
            hint={getSchemaFieldHint({
              ...effective,
              items: itemsResolved,
            })}
          >
            <TextInput
              value={(getPathValue(formData, fullName) || []).join(", ")}
              onChange={(e) => {
                const parts = parseCommaSeparatedArrayValue(
                  e.target.value,
                  itemsResolved
                );
                setValue(fullName as any, parts, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
            />
          </FormGroup>
        );
      }
      case "object": {
        const props = effective.properties || {};
        return (
          <div key={fullName} className="schema-renderer__object">
            <div className="schema-renderer__object-title">{label}</div>
            <div className="schema-renderer__grid">
              {Object.entries(props).map(([childName, childSchema]) =>
                renderField(
                  childName,
                  childSchema,
                  [...path, name],
                  effective.required
                )
              )}
            </div>
          </div>
        );
      }
      default:
        return (
          <FormGroup key={fullName} label={`${label}${isRequired ? " *" : ""}`}>
            <TextInput {...register(fullName)} />
          </FormGroup>
        );
    }
  };

  const renderFormFromSchema = (root: JsonSchema | null) => {
    if (!root)
      return (
        <Form className="schema-renderer__form">
          <div className="schema-renderer__empty">No schema defined</div>
        </Form>
      );
    if (root.type === "object" && root.properties) {
      return (
        <Form className="schema-renderer__form">
          <div className="schema-renderer__grid">
            {Object.entries(root.properties).map(([name, prop]) =>
              renderField(name, prop, [], root.required)
            )}
          </div>
        </Form>
      );
    }
    // Fallback: single field renderer
    return (
      <Form className="schema-renderer__form">
        {renderField("value", root || { type: "string" })}
      </Form>
    );
  };

  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(formData ?? {}, null, 2);
    } catch {
      return "{}";
    }
  }, [formData]);

  const jsonPreviewData = React.useMemo(() => {
    if (formData && typeof formData === "object") {
      return formData;
    }

    return { value: formData ?? null };
  }, [formData]);

  // Emit live JSON (minified) and the data object when the form changes
  React.useEffect(() => {
    if (!onJsonChange) return;
    try {
      const minified = JSON.stringify(formData ?? {});
      onJsonChange(minified, formData);
    } catch {
      onJsonChange("{}", formData);
    }
  }, [formData, onJsonChange]);

  const copyJson = React.useCallback(async () => {
    const success = await copyToClipboard(jsonString);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [jsonString]);

  // [AI-CHAT-DISABLED] AI prefill handler
  // const handleAIPrefill = async () => {
  //   if (!schemaString) return;
  //   setAiLoading(true);
  //   try {
  //     const generated = await generateInstanceFromJsonSchema(schemaString);
  //     if (generated && typeof generated === "object") {
  //       reset(generated);
  //     }
  //   } catch (e) {
  //     console.error("AI fill failed", e);
  //   } finally {
  //     setAiLoading(false);
  //   }
  // };

  return (
    <div className="schema-renderer">
      <div className="schema-renderer__tabs">
        {/* [AI-CHAT-DISABLED] AI Fill button
        {schema && (
          <button
            type="button"
            className="schema-renderer__tab schema-renderer__tab--ai"
            title={
              aiAvailable
                ? "AI prefill based on schema"
                : "AI key not configured in Chat settings"
            }
            onClick={handleAIPrefill}
            disabled={!aiAvailable || aiLoading}
          >
            {aiLoading ? "Filling\u2026" : "\u2727 Fill"}
          </button>
        )}
        */}
        {!hidePrint && (
          <button
            type="button"
            className={`schema-renderer__tab ${
              activeTab === "print" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("print")}
          >
            Print
          </button>
        )}
        <button
          type="button"
          className={`schema-renderer__tab ${
            activeTab === "form" ? "is-active" : ""
          }`}
          onClick={() => {
            if (!didPrefill && defaultValues !== undefined) {
              reset(defaultValues);
              setDidPrefill(true);
            }
            setActiveTab("form");
          }}
        >
          Form
        </button>
        <button
          type="button"
          className={`schema-renderer__tab ${
            activeTab === "json" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("json")}
        >
          JSON
        </button>
      </div>

      {!hidePrint &&
        activeTab === "print" &&
        (schema ? (
          <JsonViewer className="schema-renderer__code-block" data={schema} />
        ) : (
          <pre className="schema-renderer__code-block">
            {formatSchema(schemaString)}
          </pre>
        ))}

      {activeTab === "form" && (
        <div className="schema-renderer__form-wrapper">
          {renderFormFromSchema(resolvedRoot)}
          <div
            className="schema-renderer__json-inline"
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className={`code-modal__copy-btn${
                copied ? " code-modal__copy-btn--copied" : ""
              }`}
              onClick={copyJson}
              title={copied ? "Copied!" : "Copy to clipboard"}
              aria-label={copied ? "Copied" : "Copy code"}
            />
            <JsonViewer
              className="schema-renderer__code-block"
              data={jsonPreviewData}
            />
          </div>
        </div>
      )}

      {activeTab === "json" && (
        <div className="schema-renderer__json" style={{ position: "relative" }}>
          <button
            type="button"
            className={`code-modal__copy-btn${
              copied ? " code-modal__copy-btn--copied" : ""
            }`}
            onClick={copyJson}
            title={copied ? "Copied!" : "Copy to clipboard"}
            aria-label={copied ? "Copied" : "Copy code"}
          />
          <JsonViewer
            className="schema-renderer__code-block"
            data={jsonPreviewData}
          />
        </div>
      )}
    </div>
  );
};

export default SchemaRenderer;
