import type { ElementKind, WithElementKind } from "../../schema/model";
import { elementKindSymbol } from "../../schema/model";
import type { Introspector } from "./Introspector";
import type { DiagnosticItem } from "../../schema/model";

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

export function stringifyIfObject(input: any): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
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
    .filter((e) => e.id !== "globals.events.ready")
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
      const autoApplyEnabled = Boolean((m as any).autoApply?.enabled);
      return !used && !autoApplyEnabled;
    })
    .map((m) => ({ id: m.id }));
}

export function computeOverrideConflicts(
  introspector: Introspector
): Array<{ targetId: string; by: string }> {
  // If multiple resources declare overrides for the same target, it is a conflict.
  const resources = introspector.getResources();
  const targetToBy = new Map<string, Set<string>>();
  for (const r of resources) {
    for (const target of r.overrides ?? []) {
      if (!targetToBy.has(target)) targetToBy.set(target, new Set());
      targetToBy.get(target)!.add(r.id);
    }
  }
  const result: Array<{ targetId: string; by: string }> = [];
  for (const [target, bySet] of targetToBy) {
    if (bySet.size > 1) {
      for (const by of bySet) {
        result.push({ targetId: target, by });
      }
    }
  }
  // stable ordering
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
    if (isSystemEventId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "ORPHAN_EVENT",
      message: `Event has no hooks: ${e.id}`,
      nodeId: e.id,
      nodeKind: "EVENT",
    });
  }
  for (const e of computeUnemittedEvents(introspector)) {
    if (isSystemEventId(e.id)) continue;
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

  for (const c of computeOverrideConflicts(introspector)) {
    diags.push({
      severity: "error",
      code: "OVERRIDE_CONFLICT",
      message: `Override conflict on ${c.targetId} by ${c.by}`,
      nodeId: c.targetId,
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
  const id = String(eventId).toLowerCase();
  return id.startsWith("globals.") || id === "*";
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
