import type { JsonSchemaLike } from "./schemaDefaults";

export function getSchemaStringInputType(
  schema: Pick<JsonSchemaLike, "format">
): "text" | "email" | "url" {
  switch (schema.format) {
    case "email":
      return "email";
    case "uri":
    case "url":
      return "url";
    default:
      return "text";
  }
}

function coerceArrayToken(
  token: string,
  itemSchema?: Pick<JsonSchemaLike, "type">
): unknown {
  const trimmed = token.trim();

  switch (itemSchema?.type) {
    case "number": {
      const value = Number(trimmed);
      return Number.isNaN(value) ? trimmed : value;
    }
    case "integer": {
      const value = Number.parseInt(trimmed, 10);
      return Number.isNaN(value) ? trimmed : value;
    }
    case "boolean": {
      const normalized = trimmed.toLowerCase();

      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }

      return trimmed;
    }
    default:
      return trimmed;
  }
}

export function parseCommaSeparatedArrayValue(
  value: string,
  itemSchema?: Pick<JsonSchemaLike, "type">
): unknown[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => coerceArrayToken(part, itemSchema));
}

export function getSchemaFieldHint(
  schema: Pick<JsonSchemaLike, "description" | "type" | "format"> & {
    items?: Pick<JsonSchemaLike, "type">;
  }
): string | undefined {
  if (schema.description) {
    return schema.description;
  }

  if (schema.type === "array") {
    const itemType = schema.items?.type || "value";
    return `Comma-separated ${itemType} values.`;
  }

  if (schema.format === "date-time") {
    return "Use an ISO date-time value.";
  }

  return undefined;
}

export function getSchemaArrayEnumOptions(
  schema: Pick<JsonSchemaLike, "type" | "items"> & {
    items?: Pick<JsonSchemaLike, "enum">;
  }
): string[] | undefined {
  if (schema.type !== "array" || !schema.items?.enum) {
    return undefined;
  }

  const stringOptions = schema.items.enum.filter(
    (option): option is string => typeof option === "string"
  );

  return stringOptions.length > 0 ? stringOptions : undefined;
}
