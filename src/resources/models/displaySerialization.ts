import {
  isAsyncContext,
  isError,
  isEvent,
  isHook,
  isResource,
  isResourceMiddleware,
  isResourceWithConfig,
  isTag,
  isTask,
  isTaskMiddleware,
} from "@bluelibs/runner";

// These limits apply to one display value, never to the registered graph.
const MAX_VALUES = 10_000;
const MAX_DEPTH = 40;
const MAX_STRING_CHARACTERS = 128_000;
const TRUNCATED = "[Truncated]";

type DisplayValue =
  | null
  | boolean
  | number
  | string
  | DisplayValue[]
  | {
      [key: string]: DisplayValue;
    };

function definitionKind(value: unknown): string | null {
  if (isResourceWithConfig(value) || isResource(value)) return "resource";
  if (isTask(value)) return "task";
  if (isHook(value)) return "hook";
  if (isEvent(value)) return "event";
  if (isTag(value)) return "tag";
  if (isTaskMiddleware(value)) return "taskMiddleware";
  if (isResourceMiddleware(value)) return "resourceMiddleware";
  if (isAsyncContext(value)) return "asyncContext";
  if (isError(value)) return "error";
  return null;
}

export function stringifyDisplayValue(input: unknown): string | null {
  if (input == null) return null;
  let remainingValues = MAX_VALUES;
  let remainingCharacters = MAX_STRING_CHARACTERS;
  const ancestors = new WeakSet<object>();

  function text(value: string): string {
    const available = Math.max(0, remainingCharacters);
    remainingCharacters -= value.length;
    return value.length <= available
      ? value
      : value.slice(0, available) + TRUNCATED;
  }

  function visit(value: unknown, depth: number): DisplayValue | undefined {
    if (--remainingValues < 0 || depth > MAX_DEPTH) return TRUNCATED;
    if (value == null) return value === null ? null : undefined;
    if (typeof value === "string") return text(value);
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value;
    if (typeof value === "bigint") return text(`${value}n`);
    if (typeof value === "symbol") return text(value.toString());

    const kind = definitionKind(value);
    if (kind) {
      // Definitions are already documented separately. Expanding dependencies
      // here duplicates shared graphs exponentially inside root configuration.
      const reference: Record<string, DisplayValue> = {
        $runner: kind,
        id: text(String((value as { id: unknown }).id)),
      };
      const config = Object.getOwnPropertyDescriptor(value, "config");
      if (config && "value" in config && config.value !== undefined) {
        if (ancestors.has(value)) return "[Circular]";
        ancestors.add(value);
        reference.config = visit(config.value, depth + 1) ?? null;
        ancestors.delete(value);
      }
      return reference;
    }
    if (typeof value === "function")
      return text(`[Function${value.name ? ` ${value.name}` : ""}]`);
    if (typeof value !== "object") return text(String(value));
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (ancestors.has(value)) return "[Circular]";
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        const result: DisplayValue[] = [];
        for (const entry of value) {
          if (remainingValues <= 0) {
            result.push(TRUNCATED);
            break;
          }
          result.push(visit(entry, depth + 1) ?? null);
        }
        return result;
      }
      const result: Record<string, DisplayValue> = Object.create(null);
      const enumerableKeys = Object.keys(value);
      // Keep opaque contexts inspectable without executing their getters.
      const keys = enumerableKeys.length
        ? enumerableKeys
        : Object.getOwnPropertyNames(value);
      const prototype = Object.getPrototypeOf(value);
      if (
        !enumerableKeys.length &&
        prototype !== Object.prototype &&
        prototype !== null
      ) {
        result["[prototype]"] = text(prototype?.constructor?.name ?? "Object");
      }
      for (const key of keys) {
        if (remainingValues <= 0 || remainingCharacters <= 0) {
          result[TRUNCATED] = TRUNCATED;
          break;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) continue;
        const normalized =
          "value" in descriptor
            ? visit(descriptor.value, depth + 1)
            : descriptor.get
            ? descriptor.set
              ? "[Getter/Setter]"
              : "[Getter]"
            : "[Setter]";
        if (normalized !== undefined) result[text(key)] = normalized;
      }
      if (!enumerableKeys.length) {
        for (const symbol of Object.getOwnPropertySymbols(value)) {
          if (remainingValues <= 0 || remainingCharacters <= 0) break;
          const descriptor = Object.getOwnPropertyDescriptor(value, symbol);
          if (!descriptor) continue;
          const normalized =
            "value" in descriptor
              ? visit(descriptor.value, depth + 1)
              : "[Getter]";
          if (normalized !== undefined)
            result[text(symbol.toString())] = normalized;
        }
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  const normalized = visit(input, 0);
  // String inputs have historically been displayed without JSON quoting.
  return typeof input === "string"
    ? String(normalized)
    : JSON.stringify(normalized) ?? null;
}
