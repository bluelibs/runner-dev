// Aliased so the global `Console` interface stays usable as a type.
import { Console as NodeConsole } from "node:console";
import { Writable } from "node:stream";
import { serializeShellResult, truncateWithMarker } from "./swap.tools";

export interface CapturedConsole {
  console: Console;
  logs: string[];
}

export const MAX_SHELL_LOG_LINES = 200;
export const MAX_SHELL_LOG_CHARS = 20000;
export const SHELL_LOG_LIMIT_MARKER = `… [log limit reached (${MAX_SHELL_LOG_LINES} lines / ${MAX_SHELL_LOG_CHARS} chars); further output dropped]`;

/** Methods whose arguments are formatted like shell results (JSON-ish). */
const VALUE_LOG_METHODS = ["log", "info", "warn", "error", "debug"] as const;

/**
 * Methods rendered by Node's own Console formatting (tables, stack traces,
 * `util.inspect` output). They must be captured explicitly: the global
 * console's methods are bound to it, so inherited ones write straight to the
 * server's stdout/stderr and bypass capture.
 */
const NODE_RENDERED_METHODS = [
  "dir",
  "table",
  "trace",
  "assert",
  "count",
] as const;

type CapturedMethod =
  | (typeof VALUE_LOG_METHODS)[number]
  | (typeof NODE_RENDERED_METHODS)[number];

/** Methods shown without a `[method]` prefix, like plain `console.log`. */
const UNPREFIXED_METHODS = new Set<CapturedMethod>([
  "log",
  "dir",
  "table",
  "count",
]);

function formatShellLogValue(value: unknown): string {
  return typeof value === "string" ? value : serializeShellResult(value);
}

/**
 * A private Console writing into a string buffer, so Node formats `table`,
 * `trace`, `dir`, ... exactly as it would on a terminal. One renderer per
 * captured console keeps `count` state scoped to a single shell run.
 */
function createNodeConsoleRenderer() {
  let buffer = "";
  const sink = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      buffer += chunk.toString();
      callback();
    },
  });
  const renderer = new NodeConsole({
    stdout: sink,
    stderr: sink,
    colorMode: false,
  });

  return (
    method: (typeof NODE_RENDERED_METHODS)[number],
    args: unknown[]
  ): string | null => {
    buffer = "";
    // Node Console writes synchronously into the sink.
    Reflect.apply(renderer[method], renderer, args);
    // Some calls print nothing (a passing `assert`); those add no line.
    return buffer === "" ? null : buffer.replace(/\n$/, "");
  };
}

/**
 * Creates a console shim that captures log lines for shell responses while
 * still forwarding everything to the real server console.
 *
 * Output is bounded (line count and total chars); an over-long line is cut
 * with a visible marker and the first line past the limit is replaced by a
 * single "limit reached" marker, so users always see that output was lost.
 */
export function createCapturedConsole(): CapturedConsole {
  const logs: string[] = [];
  let capturedChars = 0;
  let limitReached = false;

  const push = (method: CapturedMethod, line: string) => {
    if (limitReached) return;
    const remainingChars = MAX_SHELL_LOG_CHARS - capturedChars;
    if (logs.length >= MAX_SHELL_LOG_LINES || remainingChars <= 0) {
      logs.push(SHELL_LOG_LIMIT_MARKER);
      limitReached = true;
      return;
    }
    const stamped = UNPREFIXED_METHODS.has(method)
      ? line
      : `[${method}] ${line}`;
    logs.push(truncateWithMarker(stamped, remainingChars));
    capturedChars += Math.min(stamped.length, remainingChars);
  };

  const realConsole = globalThis.console;
  const renderWithNode = createNodeConsoleRenderer();
  // Inherit everything else (time, group, ...) from the real console.
  const captured: Console = Object.create(realConsole);

  for (const method of VALUE_LOG_METHODS) {
    captured[method] = (...args: unknown[]) => {
      push(method, args.map(formatShellLogValue).join(" "));
      Reflect.apply(realConsole[method], realConsole, args);
    };
  }
  for (const method of NODE_RENDERED_METHODS) {
    captured[method] = (...args: unknown[]) => {
      const rendered = renderWithNode(method, args);
      if (rendered !== null) push(method, rendered);
      Reflect.apply(realConsole[method], realConsole, args);
    };
  }

  return { console: captured, logs };
}
