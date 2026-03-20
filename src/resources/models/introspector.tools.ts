import type { ElementKind, WithElementKind } from "../../schema/model";
import { elementKindSymbol } from "../../schema/model";
import type { Introspector } from "./Introspector";
import type { DiagnosticItem } from "../../schema/model";
import { isSystemNamespaceId } from "../../utils/system-namespace";

export function buildIdMap<T extends { id: string }>(
  items: T[]
): Map<string, T> {
  return new Map(items.map((i) => [i.id, i] as const));
}

export function ensureStringArray(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((v) => (typeof v === "string" ? v : readId(v)))
      .filter(Boolean);
  }
  if (typeof input === "string") return [input];
  return [];
}

export function toArray(collection: any): any[] {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection instanceof Map) return Array.from(collection.values());
  if (typeof collection === "object") return Object.values(collection);
  return [];
}

export function readId(obj: any): string {
  if (!obj) return "";
  if (typeof obj.id === "string") return obj.id;
  return String(obj);
}

function hasHiddenObjectDetails(input: unknown): boolean {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  return (
    Object.getOwnPropertyNames(input).length > 0 ||
    Object.getOwnPropertySymbols(input).length > 0 ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  );
}

function normalizeForDisplay(
  input: unknown,
  seen = new WeakSet<object>()
): unknown {
  if (input === undefined) return "[undefined]";
  if (typeof input === "function") {
    return `[Function${input.name ? ` ${input.name}` : ""}]`;
  }
  if (typeof input === "symbol") {
    return input.toString();
  }
  if (typeof input === "bigint") {
    return `${input}n`;
  }
  if (
    input == null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? String(input) : input.toISOString();
  }
  if (input instanceof RegExp) {
    return input.toString();
  }
  if (typeof input !== "object") {
    return String(input);
  }
  if (seen.has(input)) {
    return "[Circular]";
  }

  seen.add(input);

  if (Array.isArray(input)) {
    return input.map((entry) => normalizeForDisplay(entry, seen));
  }

  const normalized: Record<string, unknown> = {};
  const prototype = Object.getPrototypeOf(input);
  const isPlainObject = prototype === Object.prototype || prototype === null;

  if (!isPlainObject) {
    normalized["[prototype]"] =
      prototype?.constructor?.name || String(prototype);
  }

  for (const key of Object.getOwnPropertyNames(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor) continue;

    if ("value" in descriptor) {
      normalized[key] = normalizeForDisplay(descriptor.value, seen);
      continue;
    }

    normalized[key] = descriptor.get
      ? descriptor.set
        ? "[Getter/Setter]"
        : "[Getter]"
      : "[Setter]";
  }

  for (const symbol of Object.getOwnPropertySymbols(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, symbol);
    const symbolKey = symbol.toString();
    if (!descriptor) continue;

    if ("value" in descriptor) {
      normalized[symbolKey] = normalizeForDisplay(descriptor.value, seen);
      continue;
    }

    normalized[symbolKey] = descriptor.get
      ? descriptor.set
        ? "[Getter/Setter]"
        : "[Getter]"
      : "[Setter]";
  }

  return normalized;
}

export function stringifyIfObject(input: any): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input;
  try {
    const stringified = JSON.stringify(input);
    if (stringified === "{}" && hasHiddenObjectDetails(input)) {
      return JSON.stringify(normalizeForDisplay(input));
    }

    return stringified;
  } catch {
    return JSON.stringify(normalizeForDisplay(input));
  }
}

// Diagnostics helpers
export function computeOrphanEvents(
  introspector: Introspector
): { id: string }[] {
  // Events with no specific hooks. Wildcard-only listeners should not count.
  const events = introspector.getEvents();
  return events
    .filter((e) => introspector.getHooksOfEvent(e.id).length === 0)
    .map((e) => ({ id: e.id }));
}

export function computeUnemittedEvents(
  introspector: Introspector
): { id: string }[] {
  const events = introspector.getEvents();
  return events
    .filter((e) => introspector.getEmittersOfEvent(e.id).length === 0)
    .filter((e) => e.id !== "system.events.ready")
    .filter((e) => e.id !== "*")
    .map((e) => ({ id: e.id }));
}

export function computeUnusedMiddleware(
  introspector: Introspector
): { id: string }[] {
  const middlewares = introspector.getMiddlewares();
  return middlewares
    .filter((m) => {
      const used =
        (m.usedByTasks?.length ?? 0) > 0 ||
        (m.usedByResources?.length ?? 0) > 0;
      const autoApplyEnabled = Boolean(m.autoApply?.enabled);
      return !used && !autoApplyEnabled;
    })
    .map((m) => ({ id: m.id }));
}

export function computeOverrideConflicts(
  introspector: Introspector
): Array<{ targetId: string; by: string }> {
  const resources = introspector.getResources();
  const targetToBy = new Map<string, Set<string>>();

  for (const resource of resources) {
    for (const targetId of resource.overrides ?? []) {
      if (!targetToBy.has(targetId)) {
        targetToBy.set(targetId, new Set());
      }

      targetToBy.get(targetId)!.add(resource.id);
    }
  }

  const result: Array<{ targetId: string; by: string }> = [];

  for (const [targetId, owners] of targetToBy.entries()) {
    if (owners.size < 2) continue;

    for (const by of owners) {
      result.push({ targetId, by });
    }
  }

  result.sort((a, b) =>
    a.targetId === b.targetId
      ? a.by.localeCompare(b.by)
      : a.targetId.localeCompare(b.targetId)
  );

  return result;
}

export function computeOverriddenElements(introspector: Introspector): Array<{
  id: string;
  kind: "TASK" | "HOOK" | "MIDDLEWARE";
  overriddenBy: string;
}> {
  const result: Array<{
    id: string;
    kind: "TASK" | "HOOK" | "MIDDLEWARE";
    overriddenBy: string;
  }> = [];

  for (const task of introspector.getTasks()) {
    if (task.overriddenBy) {
      result.push({
        id: task.id,
        kind: "TASK",
        overriddenBy: task.overriddenBy,
      });
    }
  }

  for (const hook of introspector.getHooks()) {
    if (hook.overriddenBy) {
      result.push({
        id: hook.id,
        kind: "HOOK",
        overriddenBy: hook.overriddenBy,
      });
    }
  }

  for (const middleware of introspector.getMiddlewares()) {
    if (middleware.overriddenBy) {
      result.push({
        id: middleware.id,
        kind: "MIDDLEWARE",
        overriddenBy: middleware.overriddenBy,
      });
    }
  }

  result.sort((a, b) =>
    a.id === b.id
      ? a.kind === b.kind
        ? a.overriddenBy.localeCompare(b.overriddenBy)
        : a.kind.localeCompare(b.kind)
      : a.id.localeCompare(b.id)
  );

  return result;
}

export function computeUnusedErrors(
  introspector: Introspector
): Array<{ id: string }> {
  return introspector
    .getErrors()
    .filter((error) => (error.thrownBy?.length ?? 0) === 0)
    .map((error) => ({ id: error.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildDiagnostics(introspector: Introspector): DiagnosticItem[] {
  const diags: DiagnosticItem[] = [];

  // Anonymous (Symbol) IDs
  const _collections: Array<{
    kind: "RESOURCE" | "TASK" | "HOOK" | "EVENT" | "MIDDLEWARE";
    nodes: Array<{ id: string }>;
  }> = [
    { kind: "RESOURCE", nodes: introspector.getResources() },
    { kind: "TASK", nodes: introspector.getTasks() },
    { kind: "HOOK", nodes: introspector.getHooks() },
    { kind: "EVENT", nodes: introspector.getEvents() },
    { kind: "MIDDLEWARE", nodes: introspector.getMiddlewares() },
  ];

  for (const e of computeOrphanEvents(introspector)) {
    if (isIgnoredEventDiagnosticId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "ORPHAN_EVENT",
      message: `Event has no hooks: ${e.id}`,
      nodeId: e.id,
      nodeKind: "EVENT",
    });
  }
  for (const e of computeUnemittedEvents(introspector)) {
    if (isIgnoredEventDiagnosticId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "UNEMITTED_EVENT",
      message: `Event has no emitters: ${e.id}`,
      nodeId: e.id,
      nodeKind: "EVENT",
    });
  }
  for (const m of computeUnusedMiddleware(introspector)) {
    if (isSystemEventId(m.id)) continue;
    diags.push({
      severity: "info",
      code: "UNUSED_MIDDLEWARE",
      message: `Middleware is defined but not used: ${m.id}`,
      nodeId: m.id,
      nodeKind: "MIDDLEWARE",
    });
  }

  for (const conflict of computeOverrideConflicts(introspector)) {
    diags.push({
      severity: "error",
      code: "OVERRIDE_CONFLICT",
      message: `Override conflict on ${conflict.targetId} by ${conflict.by}`,
      nodeId: conflict.targetId,
      nodeKind: "RESOURCE",
    });
  }

  for (const item of computeOverriddenElements(introspector)) {
    diags.push({
      severity: "info",
      code: "OVERRIDDEN_ELEMENT",
      message: `${item.kind} is overridden by ${item.overriddenBy}: ${item.id}`,
      nodeId: item.id,
      nodeKind: item.kind,
    });
  }

  for (const error of computeUnusedErrors(introspector)) {
    diags.push({
      severity: "info",
      code: "UNUSED_ERROR",
      message: `Error is defined but never used: ${error.id}`,
      nodeId: error.id,
      nodeKind: "ERROR",
    });
  }

  diags.sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    const an = a.nodeId ?? "";
    const bn = b.nodeId ?? "";
    if (an !== bn) return an.localeCompare(bn);
    return a.message.localeCompare(b.message);
  });

  return diags;
}

// System events helpers
export function isSystemEventId(eventId: string): boolean {
  return isSystemNamespaceId(eventId) || eventId === "*";
}

function isIgnoredEventDiagnosticId(eventId: string): boolean {
  if (isSystemEventId(eventId)) return true;

  const id = String(eventId).toLowerCase();
  const normalizedId = id.replace(/-/g, ".");
  // Durable workflow runtime emits framework-owned internal events that are not
  // application-level extension points and should not be treated as diagnostics noise.
  return (
    /(^|\.)durable\.audit\./.test(normalizedId) ||
    /(^|\.)durable\.emit\./.test(normalizedId) ||
    /(^|\.)durable\.execution\./.test(normalizedId) ||
    /(^|\.)durable\.note\./.test(normalizedId)
  );
}

// Internal helper to stamp a non-enumerable discriminator used by GraphQL type resolution
export function stampElementKind<T extends object>(
  obj: T,
  kind: ElementKind
): WithElementKind<T> {
  try {
    Object.defineProperty(obj, elementKindSymbol, {
      value: kind,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // best-effort; if it fails, we ignore
  }
  return obj as WithElementKind<T>;
}
