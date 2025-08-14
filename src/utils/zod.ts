import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToReadableText } from "./json-schema-to-readable";

export type ZodTypeAny = z.ZodTypeAny;

export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === "object" && value !== null && value instanceof z.ZodType
  );
}

export function formatZodSchemaNicely(schema: ZodTypeAny): string {
  try {
    const jsonSchema = zodToJsonSchema(schema, { name: "Schema" });
    return JSON.stringify(jsonSchema, null, 2);
  } catch {
    // Fallback to minimal string
    return String(schema);
  }
}

export function formatSchemaIfZod(value: unknown): string | null {
  try {
    if (isZodSchema(value)) {
      return formatZodSchemaNicely(value);
    }
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
