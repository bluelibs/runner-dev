import * as ts from "typescript";
import type { Store } from "@bluelibs/runner";

/**
 * Compile TypeScript/JavaScript code and return the compiled function
 */
export function compileRunFunction(
  code: string
): { success: true; func: Function } | { success: false; error: string } {
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
    let func: Function;
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

/**
 * Get task from store by ID
 */
export function getTaskFromStore(store: Store, taskId: string) {
  if (taskId.includes("Symbol")) {
    for (const taskElement of store.tasks.values()) {
      if (taskElement.task.id.toString() === taskId) {
        return taskElement.task;
      }
    }
  }

  const taskStoreElement = store.tasks.get(taskId);

  return taskStoreElement?.task;
}

/**
 * Get task from store by ID
 */
export function getEventFromStore(store: Store, eventId: string) {
  if (eventId.includes("Symbol")) {
    for (const eventElement of store.events.values()) {
      if (eventElement.event.id.toString() === eventId) {
        return eventElement.event;
      }
    }
  }

  const eventStoreElement = store.events.get(eventId);

  return eventStoreElement?.event;
}

/**
 * Get computed dependencies for a task from store
 */
export function getTaskDependencies(store: any, taskId: string): any {
  try {
    // Prefer reading from the task store element directly to access computedDependencies
    let storeElement = store.tasks.get(taskId);

    if (!storeElement) {
      // Handle symbol-based task ids where Map key may differ from id string
      for (const candidate of store.tasks.values()) {
        if (candidate?.task && String(candidate.task.id) === taskId) {
          storeElement = candidate;
          break;
        }
      }
    }

    const dependencies = storeElement?.computedDependencies;
    return dependencies ?? {};
  } catch (error) {
    // If anything fails, return empty dependencies to prevent crashes
    return {};
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
