export type JsonSchemaLike = {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
  enum?: Array<string | number | boolean | null>;
  default?: unknown;
  "x-runner-runtime-type"?: string;
};

type ComputeSchemaDefaultValueOptions = {
  fieldName?: string;
};

const FRIENDLY_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function toFriendlyFieldToken(fieldName?: string): string {
  if (!fieldName) {
    return "value";
  }

  const normalized = fieldName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

  return (
    normalized
      .split("-")
      .filter(Boolean)
      .filter(
        (token) => !["created", "updated", "deleted", "changed"].includes(token)
      )
      .join("-") || "value"
  );
}

function singularizeFriendlyToken(token: string): string {
  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

function isDateTimeSchema(schema: JsonSchemaLike): boolean {
  return (
    schema.type === "string" &&
    schema.format === "date-time" &&
    schema["x-runner-runtime-type"] === "Date"
  );
}

function generateFriendlyRandomId(length = 32): string {
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * FRIENDLY_ID_ALPHABET.length);
    result += FRIENDLY_ID_ALPHABET[index];
  }

  return result;
}

function inferFriendlyStringDefault(
  schema: JsonSchemaLike,
  fieldName?: string
): string | undefined {
  const normalizedFieldName = fieldName?.toLowerCase();
  const friendlyToken = singularizeFriendlyToken(
    toFriendlyFieldToken(fieldName)
  );

  if (
    normalizedFieldName &&
    (normalizedFieldName.endsWith("id") || normalizedFieldName.endsWith("_id"))
  ) {
    return generateFriendlyRandomId();
  }

  if (schema.format === "email") {
    return "user@example.com";
  }

  if (schema.format === "uri" || schema.format === "url") {
    return "https://example.com";
  }

  if (
    normalizedFieldName === "email" ||
    normalizedFieldName?.endsWith("_email")
  ) {
    return "user@example.com";
  }

  if (normalizedFieldName === "url" || normalizedFieldName?.endsWith("_url")) {
    return "https://example.com";
  }

  if (
    normalizedFieldName?.endsWith("at") ||
    normalizedFieldName?.endsWith("_at") ||
    normalizedFieldName?.endsWith("date") ||
    normalizedFieldName?.endsWith("_date")
  ) {
    return new Date().toISOString();
  }

  if (normalizedFieldName === "name") {
    return "Sample Name";
  }

  if (normalizedFieldName === "title") {
    return "Sample Title";
  }

  if (normalizedFieldName === "description") {
    return "Sample description";
  }

  if (friendlyToken === "sku") {
    return "sku-demo-001";
  }

  return `${friendlyToken}-sample`;
}

function inferFriendlyArrayDefault(
  schema: JsonSchemaLike,
  fieldName?: string
): unknown[] | undefined {
  if (schema.items?.type !== "string") {
    return undefined;
  }

  const baseToken = singularizeFriendlyToken(toFriendlyFieldToken(fieldName));

  if (baseToken === "sku") {
    return ["sku-demo-001", "sku-demo-002"];
  }

  if (
    schema.items.enum &&
    schema.items.enum.length > 0 &&
    schema.items.enum.every((value) => typeof value === "string")
  ) {
    return schema.items.enum.slice(0, 2);
  }

  return [`${baseToken}-sample-1`, `${baseToken}-sample-2`];
}

export function computeSchemaDefaultValue(
  schema: JsonSchemaLike | undefined,
  options: ComputeSchemaDefaultValueOptions = {}
): unknown {
  if (!schema) return undefined;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  if (isDateTimeSchema(schema)) return new Date().toISOString();

  switch (schema.type) {
    case "string":
      return inferFriendlyStringDefault(schema, options.fieldName) ?? "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "array":
      return inferFriendlyArrayDefault(schema, options.fieldName) ?? [];
    case "object": {
      const result: Record<string, unknown> = {};

      if (schema.properties) {
        for (const [key, child] of Object.entries(schema.properties)) {
          result[key] = computeSchemaDefaultValue(child, { fieldName: key });
        }
      }

      return result;
    }
    default:
      return undefined;
  }
}
