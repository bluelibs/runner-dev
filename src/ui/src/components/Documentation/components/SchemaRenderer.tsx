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
import "./SchemaRenderer.scss";

export interface SchemaRendererProps {
  schemaString?: string | null;
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

function computeSimpleDefault(schema: JsonSchema | undefined): any {
  if (!schema) return undefined;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  switch (schema.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      // Keep empty by default to avoid overengineering
      return [];
    case "object": {
      const result: Record<string, any> = {};
      if (schema.properties) {
        for (const [key, child] of Object.entries(schema.properties)) {
          result[key] = computeSimpleDefault(child);
        }
      }
      return result;
    }
    default:
      return undefined;
  }
}

function computeDefaults(schema: JsonSchema | null): any {
  if (!schema) return undefined;
  return computeSimpleDefault(schema);
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
}) => {
  const [activeTab, setActiveTab] = React.useState<"print" | "form" | "json">(
    "print"
  );
  const [didPrefill, setDidPrefill] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null);
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

  const { register, control, watch, setValue, reset } = useForm({
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
          <FormGroup key={fullName} label={`${label}${isRequired ? " *" : ""}`}>
            <TextInput
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
          <FormGroup key={fullName} label={`${label}${isRequired ? " *" : ""}`}>
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
        const itemsType = itemsResolved?.type || "string";
        return (
          <FormGroup
            key={fullName}
            label={`${label}${isRequired ? " *" : ""}`}
            hint={`Array of ${itemsType}. Comma-separated.`}
          >
            <TextInput
              value={(getPathValue(formData, fullName) || []).join(", ")}
              onChange={(e) => {
                const parts = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
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

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Copy failed");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  return (
    <div className="schema-renderer">
      <div className="schema-renderer__tabs">
        <button
          type="button"
          className={`schema-renderer__tab ${
            activeTab === "print" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("print")}
        >
          Print
        </button>
        <button
          type="button"
          className={`schema-renderer__tab ${
            activeTab === "form" ? "is-active" : ""
          }`}
          onClick={() => {
            if (!didPrefill && schema) {
              const funny = generateFunnySample(schema);
              if (funny && typeof funny === "object") {
                reset(funny);
              }
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

      {activeTab === "print" && (
        <pre className="schema-renderer__code-block">
          {formatSchema(schemaString)}
        </pre>
      )}

      {activeTab === "form" && (
        <div className="schema-renderer__form-wrapper">
          {renderFormFromSchema(resolvedRoot)}
          <div className="schema-renderer__json-inline">
            <div className="schema-renderer__json-actions">
              <button type="button" className="btn" onClick={copyJson}>
                {copyFeedback || "Copy JSON"}
              </button>
            </div>
            <pre className="schema-renderer__code-block">{jsonString}</pre>
          </div>
        </div>
      )}

      {activeTab === "json" && (
        <div className="schema-renderer__json">
          <div className="schema-renderer__json-actions">
            <button type="button" className="btn" onClick={copyJson}>
              {copyFeedback || "Copy JSON"}
            </button>
          </div>
          <pre className="schema-renderer__code-block">{jsonString}</pre>
        </div>
      )}
    </div>
  );
};

export default SchemaRenderer;

// ----------------------------------------------------------------------------
// Funny data generator compatible with JSON Schema structure
// ----------------------------------------------------------------------------
function generateFunnySample(schema: JsonSchema | null | undefined): any {
  if (!schema) return undefined;

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case "string":
      return pickFunnyString();
    case "number":
      return 42;
    case "integer":
      return 7;
    case "boolean":
      return true;
    case "array": {
      const itemSchema = schema.items || { type: "string" };
      return [generateFunnySample(itemSchema)];
    }
    case "object": {
      const result: Record<string, any> = {};
      const props = schema.properties || {};
      for (const [key, child] of Object.entries(props)) {
        result[key] = generateFunnySample(child);
      }
      return result;
    }
    default:
      return undefined;
  }
}

function pickFunnyString(): string {
  const options = [
    "✨ stardust",
    "🧪 lab-magic",
    "🚀 rocket-fuel",
    "🍕 pizza-slice",
    "🧩 puzzle-piece",
    "🐙 octo-value",
  ];
  return options[Math.floor(Math.random() * options.length)];
}
