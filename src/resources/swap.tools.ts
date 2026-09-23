import * as ts from "typescript";
import { types as utilTypes } from "node:util";
import type { Store } from "@bluelibs/runner";

function idsMatch(candidateId: string, referenceId: string): boolean {
  return candidateId === referenceId || candidateId.endsWith(`.${referenceId}`);
}

function findStoreElementById<T>(
  elements: Iterable<T>,
  referenceId: string,
  getId: (element: T) => string | null | undefined
): T | null {
  let suffixMatch: T | null = null;

  for (const element of elements) {
    const candidateId = getId(element);
    if (!candidateId) continue;

    if (candidateId === referenceId) {
      return element;
    }

    if (!suffixMatch && idsMatch(candidateId, referenceId)) {
      suffixMatch = element;
    }
  }

  return suffixMatch;
}

/**
 * Compile TypeScript/JavaScript code and return the compiled function
 */
export function compileRunFunction(
  code: string
):
  | { success: true; func: (...args: any[]) => any }
  | { success: false; error: string } {
  try {
    // Validate input
    if (!code || code.trim() === "") {
      return {
        success: false,
        error: "Compilation failed: Code cannot be empty",
      };
    }

    // First, try to compile as TypeScript
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      noImplicitAny: false,
      skipLibCheck: true,
    };

    // Wrap code in a function if it's not already
    let wrappedCode = code.trim();
    if (
      !wrappedCode.startsWith("function") &&
      !wrappedCode.startsWith("async function")
    ) {
      // If it's an arrow function, wrap it with return
      if (wrappedCode.includes("=>")) {
        wrappedCode = `async function run(input, deps) { return (${wrappedCode})(input, deps); }`;
      } else if (
        !wrappedCode.includes("function") &&
        wrappedCode.includes("return")
      ) {
        // It's a function body with return statements
        wrappedCode = `async function run(input, deps) { ${wrappedCode} }`;
      } else {
        // Assume it's a complete function body
        wrappedCode = `async function run(input, deps) {\n${wrappedCode}\n}`;
      }
    }

    // Basic syntax validation - only for clearly invalid code patterns
    const hasObviousErrors =
      wrappedCode.includes("{{{") ||
      wrappedCode.includes("}}}") ||
      /[{}]\s*[{}]\s*[{}]/.test(wrappedCode);
    if (hasObviousErrors) {
      return {
        success: false,
        error: "Compilation failed: Invalid syntax detected",
      };
    }

    // Try TypeScript compilation first
    const result = ts.transpile(wrappedCode, compilerOptions);

    // Create and validate the function
    // The result should be a function declaration, so we need to evaluate it and extract the function
    let func: (...args: any[]) => any;
    try {
      // Create a new context to execute the compiled code
      const context = { exports: {}, module: { exports: {} } };
      const functionCode = `
        ${result}
        return (typeof run !== 'undefined') ? run : 
               (typeof exports.default === 'function') ? exports.default :
               (typeof module.exports === 'function') ? module.exports : null;
      `;
      func = new Function("exports", "module", functionCode)(
        context.exports,
        context.module
      );
    } catch (evalError) {
      return {
        success: false,
        error: `Function evaluation failed: ${
          evalError instanceof Error ? evalError.message : String(evalError)
        }`,
      };
    }

    if (typeof func !== "function") {
      return { success: false, error: "Code must export a function" };
    }

    return { success: true, func };
  } catch (error) {
    return {
      success: false,
      error: `Compilation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function getTaskStoreElement(store: Store, taskId: string): any | null {
  return (
    store.tasks.get(taskId) ??
    findStoreElementById(store.tasks.values(), taskId, (taskElement: any) =>
      taskElement?.task ? String(taskElement.task.id) : null
    )
  );
}

/**
 * Get task from store by ID
 */
export function getTaskFromStore(store: Store, taskId: string) {
  return getTaskStoreElement(store, taskId)?.task;
}

/**
 * Get task from store by ID
 */
export function getEventFromStore(store: Store, eventId: string) {
  const eventStoreElement =
    store.events.get(eventId) ??
    findStoreElementById(store.events.values(), eventId, (entry: any) =>
      entry?.event ? String(entry.event.id) : null
    );

  return eventStoreElement?.event;
}

/**
 * Get computed dependencies for a task from store
 */
export function getTaskDependencies(store: any, taskId: string): any {
  try {
    // Prefer reading from the task store element directly to access computedDependencies
    const storeElement = getTaskStoreElement(store, taskId);

    const dependencies = storeElement?.computedDependencies;
    return dependencies ?? {};
  } catch (_error) {
    // If anything fails, return empty dependencies to prevent crashes
    return {};
  }
}

/**
 * Compile shell code with expression-first semantics.
 *
 * Shell snippets run as `async function run(deps)`, but unlike task swaps a
 * bare expression (`r`, `await runtime.runTask("x")`) is auto-returned so the
 * shell feels like a REPL. Multi-statement snippets fall back to plain
 * function-body semantics where `return` yields the result.
 */
export function compileShellFunction(
  code: string
):
  | { success: true; func: (deps: any) => any }
  | { success: false; error: string } {
  if (!code || code.trim() === "") {
    return {
      success: false,
      error: "Compilation failed: Code cannot be empty",
    };
  }

  const trimmed = code.trim();
  // Destructured so shell code uses bare `r`, `runtime`, `console`, ... and
  // the captured `console` shadows the global one.
  const params =
    "{ r, resourceId, runtime, store, introspector, globals, taskRunner, eventManager, console }";
  // Newlines around the expression keep a trailing `// comment` from
  // swallowing the closing paren (`r // check` must still return `r`).
  const expressionAttempt = compileShellWrapper(
    `async function run(${params}) { return (\n${trimmed}\n); }`
  );
  if (expressionAttempt.success) {
    return expressionAttempt;
  }

  const bodyAttempt = compileShellWrapper(
    `async function run(${params}) {\n${code}\n}`
  );
  if (bodyAttempt.success) {
    return bodyAttempt;
  }

  return {
    success: false,
    error: bodyAttempt.error,
  };
}

function compileShellWrapper(
  wrappedCode: string
):
  | { success: true; func: (deps: any) => any }
  | { success: false; error: string } {
  try {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      noImplicitAny: false,
      skipLibCheck: true,
    };

    // NB: ts.transpile() never reports syntax errors (best-effort emit), so
    // syntactic diagnostics are required to reject invalid snippets.
    const transpiled = ts.transpileModule(wrappedCode, {
      compilerOptions,
      reportDiagnostics: true,
    });
    const syntaxError = (transpiled.diagnostics ?? []).find(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
    );
    if (syntaxError) {
      const message = ts.flattenDiagnosticMessageText(
        syntaxError.messageText,
        " "
      );
      return {
        success: false,
        error: `Compilation failed: ${message}`,
      };
    }

    const functionCode = `
      ${transpiled.outputText}
      return (typeof run !== 'undefined') ? run : null;
    `;
    const func = new Function(functionCode)() as unknown;

    if (typeof func !== "function") {
      return { success: false, error: "Code must export a function" };
    }
    return { success: true, func: func as (deps: any) => any };
  } catch (error) {
    return {
      success: false,
      error: `Compilation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Serialize JavaScript value to JSON, handling complex types
 */
export function serializeResult(value: any): string {
  try {
    return JSON.stringify(
      value,
      (key, val) => {
        // Handle functions
        if (typeof val === "function") {
          return `[Function: ${val.name || "anonymous"}]`;
        }
        // Handle undefined
        if (val === undefined) {
          return "[undefined]";
        }
        // Handle circular references
        if (typeof val === "object" && val !== null) {
          if (
            val.constructor &&
            val.constructor.name !== "Object" &&
            val.constructor.name !== "Array"
          ) {
            return `[${val.constructor.name}]`;
          }
        }
        return val;
      },
      2
    );
  } catch (error) {
    return `[Serialization Error: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
}

/**
 * Upper bound for a serialized `shell` or `eval` result sent back over
 * GraphQL.
 */
export const MAX_SHELL_RESULT_CHARS = 256 * 1024;

/**
 * Cuts `text` to `maxChars` and says so: a silent cut would make a partial
 * value look complete.
 */
export function truncateWithMarker(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const omittedChars = text.length - maxChars;
  return `${text.slice(0, maxChars)}… [truncated ${omittedChars} chars]`;
}

/**
 * Serialize a shell result for display, capped at `MAX_SHELL_RESULT_CHARS`
 * so one huge value cannot balloon the response (the cap bounds the payload,
 * not the serialization work itself).
 *
 * Unlike task results (where class instances collapse to `[ClassName]`),
 * shell output keeps values inspectable: class instances serialize through
 * their enumerable properties, Maps/Sets keep their entries, and circular
 * structures degrade to `[Circular]` instead of throwing.
 */
export function serializeShellResult(value: any): string {
  return truncateWithMarker(serializeShellValue(value), MAX_SHELL_RESULT_CHARS);
}

/**
 * Serialize an `eval` result with task-result semantics (`serializeResult`)
 * under the same cap as shell results: eval runs arbitrary code, so its
 * result can be just as large.
 */
export function serializeEvalResult(value: unknown): string {
  return truncateWithMarker(serializeResult(value), MAX_SHELL_RESULT_CHARS);
}

function serializeShellValue(value: any): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;

  const seen = new WeakSet<object>();
  try {
    const serialized = JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "function") {
          return `[Function: ${val.name || "anonymous"}]`;
        }
        if (typeof val === "symbol") {
          return String(val);
        }
        if (typeof val === "bigint") {
          return `${val.toString()}n`;
        }
        if (typeof val !== "object" || val === null) {
          return val;
        }
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);

        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
            stack: val.stack,
          };
        }
        if (val instanceof Map) {
          return { $type: "Map", entries: Array.from(val.entries()) };
        }
        if (val instanceof Set) {
          return { $type: "Set", values: Array.from(val.values()) };
        }
        if (Array.isArray(val)) {
          return val;
        }
        const constructorName = val.constructor?.name;
        if (
          constructorName &&
          constructorName !== "Object" &&
          // Let built-ins with native JSON behavior pass through untouched.
          constructorName !== "Date" &&
          constructorName !== "RegExp" &&
          typeof val.toJSON !== "function"
        ) {
          return { ...val };
        }
        return val;
      },
      2
    );
    return serialized === undefined ? String(value) : serialized;
  } catch (error) {
    return `[Serialization Error: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
}

export interface ShellCompletionTarget {
  /**
   * Dotted path segments before the final dot, e.g. `["runtime"]`.
   * Empty when completing scope root names (`r`, `runtime`, ...).
   */
  objectPath: string[];
  /** Partial word being completed. */
  prefix: string;
  /** Offset in the snippet where `prefix` starts. */
  from: number;
}

export interface ShellCompletionOption {
  label: string;
  /** CodeMirror completion type: variable, property, function, method. */
  type: string;
  detail?: string;
}

const MAX_SHELL_COMPLETIONS = 100;

/**
 * Members hidden when completing through a prototype chain (plain
 * `Object.prototype` noise). Deliberately small: everything else, including
 * class methods and Map/Set members, stays visible.
 */
const HIDDEN_PROTO_KEYS = new Set([
  "constructor",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "valueOf",
]);

/**
 * Finds the completion target before the cursor: identifier-only dotted paths
 * (`runtime`, `r.db`, `store.tasks.s`). Anything involving calls, brackets,
 * or operators yields no target, which keeps completion side-effect free by
 * construction (the resolver only ever walks plain property access).
 */
export function extractCompletionTarget(
  code: string,
  position: number
): ShellCompletionTarget | null {
  const safePosition = Math.max(0, Math.min(position, code.length));
  const before = code.slice(0, safePosition);
  const match = before.match(
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(\.([A-Za-z_$][\w$]*)?)?$/
  );
  if (!match || match.index === undefined) return null;

  // Skip targets inside strings (`"run`) and line comments (`// run`).
  const matchStart = match.index;
  const prevChar = matchStart > 0 ? before[matchStart - 1] : "";
  if (prevChar === '"' || prevChar === "'" || prevChar === "`") return null;
  const lineStart = before.lastIndexOf("\n", matchStart - 1) + 1;
  if (before.slice(lineStart, matchStart).includes("//")) return null;

  const [, dotted, dotPart, partial] = match;
  const segments = dotted.split(".");
  if (dotPart !== undefined) {
    const prefix = partial ?? "";
    return {
      objectPath: segments,
      prefix,
      from: safePosition - prefix.length,
    };
  }
  const prefix = segments[segments.length - 1];
  return {
    objectPath: segments.slice(0, -1),
    prefix,
    from: safePosition - prefix.length,
  };
}

function describeShellValue(value: unknown): string | undefined {
  if (typeof value === "function") return "function";
  if (value === null) return "null";
  switch (typeof value) {
    case "string": {
      const preview = value.length > 24 ? `${value.slice(0, 24)}…` : value;
      return `string = ${JSON.stringify(preview)}`;
    }
    case "number":
    case "boolean":
    case "bigint":
      return `${typeof value} = ${String(value).slice(0, 24)}`;
    case "undefined":
    case "symbol":
    case "object":
      return typeof value;
    default:
      return undefined;
  }
}

/**
 * Objects completion may look into. Proxies are excluded without touching
 * them: even `Object.keys` or a descriptor lookup fires their traps, which
 * can run arbitrary code (ORM clients, lazy loaders) during completion.
 */
function isInspectableObject(value: unknown): value is object {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    !utilTypes.isProxy(value)
  );
}

/**
 * Reads a property without ever invoking a getter: follows data descriptors
 * up the prototype chain and reports accessors without reading them.
 */
function readShellDataProperty(
  owner: object,
  key: string
): { found: boolean; accessor: boolean; value?: unknown } {
  let current: object | null = owner;
  while (current !== null && !utilTypes.isProxy(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) {
      // Accessors are reported but never read: invoking a getter could
      // mutate live runtime state during completion.
      if (!("value" in descriptor)) {
        return { found: true, accessor: true };
      }
      return { found: true, accessor: false, value: descriptor.value };
    }
    current = Object.getPrototypeOf(current);
  }
  return { found: false, accessor: false };
}

/**
 * Lists completion options for a target against a shell scope. Never calls
 * functions, invokes getters, or touches Proxies, and caps output.
 */
export function completeShellScope(
  scope: Record<string, unknown>,
  target: ShellCompletionTarget
): ShellCompletionOption[] {
  let base: unknown = scope;
  for (const segment of target.objectPath) {
    if (!isInspectableObject(base)) {
      return [];
    }
    // Accessors are leaves: descending further would invoke the getter.
    const segmentRead = readShellDataProperty(base, segment);
    if (!segmentRead.found || segmentRead.accessor) {
      return [];
    }
    base = segmentRead.value;
  }
  if (!isInspectableObject(base)) {
    return [];
  }

  const inScope = target.objectPath.length === 0;
  const seen = new Set<string>();
  const options: ShellCompletionOption[] = [];
  const pushKey = (key: string, owner: object) => {
    if (options.length >= MAX_SHELL_COMPLETIONS) return;
    if (!key.startsWith(target.prefix) || seen.has(key)) return;
    seen.add(key);
    let type = inScope ? "variable" : "property";
    let detail: string | undefined;
    // Accessors are listed by name only: reading them would invoke the getter.
    const descriptor = Object.getOwnPropertyDescriptor(owner, key);
    if (descriptor && "value" in descriptor) {
      const value = descriptor.value;
      if (typeof value === "function") {
        type = inScope ? "function" : "method";
      }
      detail = describeShellValue(value);
    }
    const option: ShellCompletionOption = { label: key, type };
    if (detail !== undefined) option.detail = detail;
    options.push(option);
  };

  for (const key of Object.keys(base)) {
    pushKey(key, base);
  }
  // Walk the full prototype chain so inherited methods complete too, while
  // still skipping the Object.prototype noise (toString, hasOwnProperty…).
  let proto: object | null = Object.getPrototypeOf(base);
  while (
    proto !== null &&
    proto !== Object.prototype &&
    !utilTypes.isProxy(proto)
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (HIDDEN_PROTO_KEYS.has(key)) continue;
      pushKey(key, proto);
    }
    proto = Object.getPrototypeOf(proto);
  }

  options.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return options;
}

/**
 * Deserialize JSON to JavaScript value, handling basic types
 */
export function deserializeInput(jsonInput: string): any {
  try {
    return JSON.parse(jsonInput);
  } catch (error) {
    throw new Error(
      `JSON deserialization failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
