/**
 * Type guard to check if a value is a plain object (Record).
 * @param value - The value to check
 * @returns True if the value is a plain object, false otherwise
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a scalar (primitive) type.
 * @param value - The value to check
 * @returns True if the value is a scalar type (string, number, boolean, null, or undefined)
 */
export function isScalar(
  value: unknown
): value is string | number | boolean | null {
  const t = typeof value;
  return value == null || t === "string" || t === "number" || t === "boolean";
}

/**
 * Generates a preview string for an object by finding the first available scalar value.
 * Prioritizes common identifier fields like 'id', 'name', 'title', etc.
 * @param obj - The object to generate a preview for
 * @returns A preview string in the format "key=value" or undefined if no scalar found
 */
export function getFirstScalarPreview(
  obj: Record<string, unknown>
): string | undefined {
  const preferredKeys = ["id", "name", "title", "eventId", "nodeId"];
  for (const key of preferredKeys) {
    if (key in obj && isScalar(obj[key])) {
      return `${key}=${String(obj[key])}`;
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (isScalar(v)) {
      return `${k}=${String(v)}`;
    }
  }
  return undefined;
}

/**
 * Creates a concise preview string for any value type.
 * @param value - The value to create a preview for
 * @returns A short string representation of the value
 */
export function valuePreview(value: unknown): string {
  if (isScalar(value)) return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isRecord(value)) return "Object";
  return typeof value;
}

/**
 * Enhanced object formatting with depth control and better nested structure display.
 * @param obj - The object to format
 * @param currentDepth - Current nesting depth
 * @param maxDepth - Maximum allowed nesting depth
 * @param maxItems - Maximum number of items to display per level
 * @param indent - Current indentation string
 * @returns Array of formatted strings representing the object structure
 */
function formatObjectWithDepth(
  obj: Record<string, unknown>,
  currentDepth: number,
  maxDepth: number,
  maxItems: number,
  indent: string = ""
): string[] {
  const parts: string[] = [];

  if (currentDepth >= maxDepth) {
    const preview = getFirstScalarPreview(obj);
    parts.push(`${indent}{${preview ? preview : "..."}}`);
    return parts;
  }

  const entries = Object.entries(obj).slice(0, maxItems);
  for (const [key, value] of entries) {
    if (isScalar(value)) {
      parts.push(`${indent}- ${key}: ${String(value)}`);
    } else if (Array.isArray(value)) {
      parts.push(`${indent}- ${key}: Array(${value.length})`);
      if (value.length > 0 && currentDepth < maxDepth - 1) {
        const sampleItems = value.slice(0, Math.min(3, maxItems));
        for (let i = 0; i < sampleItems.length; i++) {
          const item = sampleItems[i];
          if (isRecord(item)) {
            parts.push(`${indent}  [${i}]:`);
            parts.push(
              ...formatObjectWithDepth(
                item,
                currentDepth + 1,
                maxDepth,
                maxItems,
                indent + "    "
              )
            );
          } else {
            parts.push(`${indent}  [${i}]: ${valuePreview(item)}`);
          }
        }
        if (value.length > sampleItems.length) {
          parts.push(
            `${indent}  ... and ${value.length - sampleItems.length} more items`
          );
        }
      }
    } else if (isRecord(value)) {
      parts.push(`${indent}- ${key}: Object`);
      parts.push(
        ...formatObjectWithDepth(
          value,
          currentDepth + 1,
          maxDepth,
          maxItems,
          indent + "  "
        )
      );
    } else {
      parts.push(`${indent}- ${key}: ${valuePreview(value)}`);
    }
  }

  if (Object.keys(obj).length > entries.length) {
    parts.push(
      `${indent}... and ${
        Object.keys(obj).length - entries.length
      } more properties`
    );
  }

  return parts;
}

/**
 * Enhanced GraphQL error formatting with better type safety.
 * Represents the standard GraphQL error structure.
 */
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

/**
 * Type guard to check if a value is a GraphQL error object.
 * @param value - The value to check
 * @returns True if the value conforms to GraphQL error structure
 */
function isGraphQLError(value: unknown): value is GraphQLError {
  return isRecord(value) && typeof value.message === "string";
}

/**
 * Formats a GraphQL error with enhanced information including path and location.
 * @param error - The error to format
 * @returns A formatted error message string
 */
function formatGraphQLError(error: unknown): string {
  if (isGraphQLError(error)) {
    let msg = error.message;
    if (error.path) {
      msg += ` (at path: ${error.path.join(".")})`;
    }
    if (error.locations && error.locations.length > 0) {
      const loc = error.locations[0];
      msg += ` (line ${loc.line}, column ${loc.column})`;
    }
    return msg;
  }
  return valuePreview(error);
}

/**
 * Formats GraphQL query/mutation results as readable Markdown.
 *
 * Features:
 * - Handles data, errors, and extensions sections
 * - Supports configurable depth traversal for nested objects
 * - Two presentation styles: "summary" (structured) and "story" (narrative)
 * - Intelligent truncation with maxItems limit
 * - Enhanced error formatting with path and location information
 * - Type-safe implementation with comprehensive error handling
 *
 * @param result - The GraphQL result object to format
 * @param options - Formatting options
 * @param options.title - Custom title for the output (default: "GraphQL Result")
 * @param options.maxItems - Maximum items to show per level (default: 10)
 * @param options.maxDepth - Maximum nesting depth to traverse (default: 3)
 * @param options.style - Output style: "summary" or "story" (default: "summary")
 * @returns Formatted Markdown string
 */
export function formatGraphQLResultAsMarkdown(
  result: unknown,
  options?: {
    title?: string;
    maxItems?: number;
    maxDepth?: number;
    style?: "summary" | "story";
  }
): string {
  const title = options?.title || "GraphQL Result";
  const maxItems = options?.maxItems ?? 10;
  const maxDepth = options?.maxDepth ?? 3;
  const style = options?.style || "summary";

  const parts: string[] = [];
  parts.push(`# ${title}`);

  const res = (result ?? {}) as Record<string, unknown>;
  const data = isRecord(res.data)
    ? (res.data as Record<string, unknown>)
    : undefined;
  const errors = Array.isArray(res.errors) ? (res.errors as unknown[]) : [];
  const extensions = isRecord(res.extensions)
    ? (res.extensions as Record<string, unknown>)
    : undefined;

  if (errors.length) {
    parts.push("\n## Errors");
    for (const e of errors.slice(0, maxItems)) {
      const msg = formatGraphQLError(e);
      parts.push(`- ${msg}`);
    }
    if (errors.length > maxItems) {
      parts.push(`- ... and ${errors.length - maxItems} more errors`);
    }
  }

  if (!data) {
    parts.push("\n_No data returned._");
    return parts.join("\n");
  }

  const topKeys = Object.keys(data);
  if (style === "story") {
    const sentences: string[] = [];
    sentences.push(
      "I queried the server and received the following top-level fields:"
    );
    const facts: string[] = [];
    for (const key of topKeys) {
      const val = (data as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        facts.push(`${key} (${val.length} item${val.length === 1 ? "" : "s"})`);
      } else if (isRecord(val)) {
        facts.push(`${key} (object)`);
      } else {
        facts.push(`${key}=${valuePreview(val)}`);
      }
    }
    sentences.push(facts.join(", ") + ".");
    if (errors.length) {
      sentences.push(
        `There were ${errors.length} error${
          errors.length === 1 ? "" : "s"
        } included above.`
      );
    }
    parts.push("\n" + sentences.join(" ") + "\n");
  } else {
    parts.push("\n## Data Summary");
    for (const key of topKeys) {
      const val = (data as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        parts.push(
          `- ${key}: ${val.length} item${val.length === 1 ? "" : "s"}`
        );
        if (val.length > 0) {
          const items = val.slice(0, maxItems);
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (isRecord(item)) {
              parts.push(`  [${i}]:`);
              parts.push(
                ...formatObjectWithDepth(item, 1, maxDepth, maxItems, "    ")
              );
            } else {
              parts.push(`  [${i}]: ${valuePreview(item)}`);
            }
          }
          if (val.length > items.length) {
            parts.push(`  ... and ${val.length - items.length} more items`);
          }
        }
      } else if (isRecord(val)) {
        parts.push(`- ${key}: Object`);
        parts.push(...formatObjectWithDepth(val, 1, maxDepth, maxItems, "  "));
      } else {
        parts.push(`- ${key}: ${valuePreview(val)}`);
      }
    }
  }

  // Add extensions if present
  if (extensions && Object.keys(extensions).length > 0) {
    parts.push("\n## Extensions");
    parts.push(...formatObjectWithDepth(extensions, 1, maxDepth, maxItems, ""));
  }

  return parts.join("\n");
}
