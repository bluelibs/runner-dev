import { z } from "zod";
import { z as z4 } from "zod/v4";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToReadableText } from "./json-schema-to-readable";

export type ZodTypeAny = z.ZodTypeAny;

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
    if (isZodSchema(value)) {
      return formatZodSchemaNicely(value);
    } else {
      return '{ "type": "object" }';
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
