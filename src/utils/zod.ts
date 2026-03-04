import { z } from "zod";
import { z as z4 } from "zod/v4";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToReadableText } from "./json-schema-to-readable";

export type ZodTypeAny = z.ZodTypeAny;

type JsonSchemaExporter = {
  toJSONSchema: () => unknown;
};

export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as any)?._def?.typeName?.startsWith("Zod")
    // (value instanceof z.ZodAny || value instanceof z4.ZodAny)
  );
}

function isZ4(schema: ZodTypeAny) {
  return "transformAsync" in schema;
}

function hasToJSONSchema(value: unknown): value is JsonSchemaExporter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).toJSONSchema === "function"
  );
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

function stringifyJsonSchema(value: unknown): string | null {
  const stringified = JSON.stringify(value, null, 2);
  return typeof stringified === "string" ? stringified : null;
}

function formatSchemaFromToJSONSchema(
  schema: JsonSchemaExporter
): string | null {
  try {
    const jsonSchema = schema.toJSONSchema();

    if (isPromiseLike(jsonSchema)) {
      return null;
    }

    return stringifyJsonSchema(jsonSchema);
  } catch {
    return null;
  }
}

export function formatZodSchemaNicely(schema: ZodTypeAny): string {
  try {
    const jsonSchema = isZ4(schema)
      ? z4.toJSONSchema(schema as any)
      : zodToJsonSchema(schema, { name: "Schema" });

    return JSON.stringify(jsonSchema, null, 2);
  } catch {
    // Fallback to minimal string
    return String(schema);
  }
}

export function formatSchemaIfZod(value: unknown): string | null {
  try {
    if (hasToJSONSchema(value)) {
      const formatted = formatSchemaFromToJSONSchema(value);
      if (formatted) {
        return formatted;
      }
      // Had toJSONSchema but it failed/returned async — use generic fallback
      return '{ "type": "object" }';
    }

    if (isZodSchema(value)) {
      return formatZodSchemaNicely(value);
    }

    // Not a recognized schema format — return null instead of a misleading fallback
    return null;
  } catch {
    // ignore
  }
  return null;
}

export async function convertJsonSchemaToReadable(
  jsonSchemaString: string | null | undefined
): Promise<string | null> {
  if (!jsonSchemaString) return null;

  return jsonSchemaToReadableText(jsonSchemaString);
}
