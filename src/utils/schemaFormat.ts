import { z } from "zod";
import { z as z4 } from "zod/v4";
import { zodToJsonSchema } from "zod-to-json-schema";
import { jsonSchemaToReadableText } from "./json-schema-to-readable";

export type ZodTypeAny = z.ZodTypeAny;

type JsonSchemaExporter = {
  toJSONSchema: () => unknown;
};

type MatchPatternLike = {
  kind?: string;
  pattern?: unknown;
  patterns?: unknown[];
  min?: number;
  max?: number;
  inclusive?: boolean;
  integer?: boolean;
  expression?: RegExp;
  resolver?: () => unknown;
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

function isMatchPatternLike(value: unknown): value is MatchPatternLike {
  return typeof value === "object" && value !== null && "kind" in value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isMatchPatternLike(value)
  );
}

function isOptionalLikePattern(value: unknown): boolean {
  return (
    isMatchPatternLike(value) &&
    (value.kind === "Match.OptionalPattern" ||
      value.kind === "Match.MaybePattern")
  );
}

function buildObjectJsonSchema(
  source: Record<string, unknown>,
  additionalProperties: boolean
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    properties[key] = buildJsonSchemaFromMatchPattern(value);
    if (!isOptionalLikePattern(value)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties,
  };
}

function buildJsonSchemaFromMatchPattern(pattern: unknown): unknown {
  if (pattern === String) {
    return { type: "string" };
  }

  if (pattern === Number) {
    return { type: "number" };
  }

  if (pattern === Boolean) {
    return { type: "boolean" };
  }

  if (pattern === Date) {
    return {
      type: "string",
      format: "date-time",
      "x-runner-runtime-type": "Date",
    };
  }

  if (typeof pattern === "function") {
    return {
      type: "object",
      "x-runner-runtime-type": pattern.name || "Function",
    };
  }

  if (
    pattern === null ||
    typeof pattern === "string" ||
    typeof pattern === "number" ||
    typeof pattern === "boolean"
  ) {
    return { const: pattern };
  }

  if (Array.isArray(pattern)) {
    if (pattern.length === 1) {
      return {
        type: "array",
        items: buildJsonSchemaFromMatchPattern(pattern[0]),
      };
    }

    return {
      type: "array",
      prefixItems: pattern.map((item) => buildJsonSchemaFromMatchPattern(item)),
    };
  }

  if (isMatchPatternLike(pattern)) {
    switch (pattern.kind) {
      case "Match.OptionalPattern":
        return buildJsonSchemaFromMatchPattern(pattern.pattern);
      case "Match.MaybePattern":
        return {
          anyOf: [
            buildJsonSchemaFromMatchPattern(pattern.pattern),
            { type: "null" },
          ],
        };
      case "Match.WithMessagePattern":
        return buildJsonSchemaFromMatchPattern(pattern.pattern);
      case "Match.LazyPattern":
        return buildJsonSchemaFromMatchPattern(pattern.resolver?.());
      case "Match.NonEmptyArrayPattern":
        return {
          type: "array",
          items: buildJsonSchemaFromMatchPattern(pattern.pattern),
          minItems: 1,
        };
      case "Match.MapOfPattern":
        return {
          type: "object",
          additionalProperties: buildJsonSchemaFromMatchPattern(
            pattern.pattern
          ),
        };
      case "Match.OneOfPattern":
        return {
          anyOf: (pattern.patterns ?? []).map((item) =>
            buildJsonSchemaFromMatchPattern(item)
          ),
        };
      case "Match.RegExpPattern":
        return {
          type: "string",
          pattern: pattern.expression?.source ?? "",
          ...(pattern.expression?.flags
            ? { "x-runner-regexp-flags": pattern.expression.flags }
            : {}),
          "x-runner-match-kind": "Match.RegExp",
        };
      case "Match.Any":
        return {};
      case "Match.RangePattern": {
        const schema: Record<string, unknown> = {
          type: pattern.integer ? "integer" : "number",
        };

        if (typeof pattern.min === "number") {
          schema[pattern.inclusive === false ? "exclusiveMinimum" : "minimum"] =
            pattern.min;
        }

        if (typeof pattern.max === "number") {
          schema[pattern.inclusive === false ? "exclusiveMaximum" : "maximum"] =
            pattern.max;
        }

        return schema;
      }
      case "Match.ObjectIncludingPattern":
      case "Match.ObjectStrictPattern": {
        const source = isPlainObject(pattern.pattern) ? pattern.pattern : {};
        return buildObjectJsonSchema(
          source,
          pattern.kind === "Match.ObjectIncludingPattern"
        );
      }
      default:
        break;
    }
  }

  if (hasToJSONSchema(pattern)) {
    const jsonSchema = pattern.toJSONSchema();
    if (!isPromiseLike(jsonSchema)) {
      return jsonSchema;
    }
  }

  if (isPlainObject(pattern)) {
    return buildObjectJsonSchema(pattern, false);
  }

  return { type: "object" };
}

function formatSchemaFromMatchPattern(pattern: unknown): string | null {
  try {
    return stringifyJsonSchema(buildJsonSchemaFromMatchPattern(pattern));
  } catch {
    return null;
  }
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
    if ("pattern" in schema) {
      const formatted = formatSchemaFromMatchPattern(
        (schema as JsonSchemaExporter & { pattern?: unknown }).pattern
      );
      if (formatted) {
        return formatted;
      }
    }

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
