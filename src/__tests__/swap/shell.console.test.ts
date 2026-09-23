import {
  MAX_SHELL_LOG_CHARS,
  MAX_SHELL_LOG_LINES,
  SHELL_LOG_LIMIT_MARKER,
  createCapturedConsole,
} from "../../resources/shell.console";

// Captured calls are forwarded to the real console; keep test output quiet.
const FORWARDED_METHODS = [
  "log",
  "warn",
  "dir",
  "table",
  "trace",
  "assert",
  "count",
] as const;

describe("createCapturedConsole", () => {
  let forwarded: Record<string, jest.SpyInstance>;

  beforeEach(() => {
    forwarded = {};
    for (const method of FORWARDED_METHODS) {
      forwarded[method] = jest
        .spyOn(globalThis.console, method)
        .mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("captures lines and forwards to the real console", () => {
    const captured = createCapturedConsole();
    captured.console.log("hello", { n: 1 });
    captured.console.warn("careful");
    expect(captured.logs).toHaveLength(2);
    expect(captured.logs[0]).toContain("hello");
    expect(captured.logs[1]).toBe("[warn] careful");
    expect(forwarded.log).toHaveBeenCalledWith("hello", { n: 1 });
    expect(forwarded.warn).toHaveBeenCalledWith("careful");
  });

  test("truncates an over-long line with a visible marker", () => {
    const captured = createCapturedConsole();
    const overflow = 5000;
    captured.console.log("x".repeat(MAX_SHELL_LOG_CHARS + overflow));
    expect(captured.logs).toHaveLength(1);
    expect(captured.logs[0]).toBe(
      `${"x".repeat(MAX_SHELL_LOG_CHARS)}… [truncated ${overflow} chars]`
    );
  });

  test("marks the char budget running out once, then drops output", () => {
    const captured = createCapturedConsole();
    captured.console.log("a".repeat(MAX_SHELL_LOG_CHARS - 10));
    captured.console.log("b".repeat(30));
    captured.console.log("c");
    captured.console.log("d");
    expect(captured.logs).toEqual([
      "a".repeat(MAX_SHELL_LOG_CHARS - 10),
      `${"b".repeat(10)}… [truncated 20 chars]`,
      SHELL_LOG_LIMIT_MARKER,
    ]);
  });

  test("marks the line limit once, then drops output", () => {
    const captured = createCapturedConsole();
    for (let index = 0; index < MAX_SHELL_LOG_LINES + 5; index += 1) {
      captured.console.log(`line ${index}`);
    }
    expect(captured.logs).toHaveLength(MAX_SHELL_LOG_LINES + 1);
    expect(captured.logs[MAX_SHELL_LOG_LINES - 1]).toBe(
      `line ${MAX_SHELL_LOG_LINES - 1}`
    );
    expect(captured.logs[MAX_SHELL_LOG_LINES]).toBe(SHELL_LOG_LIMIT_MARKER);
  });

  test("captures console.dir with util.inspect formatting", () => {
    const captured = createCapturedConsole();
    captured.console.dir({ deep: { deeper: { x: 1 } } }, { depth: 0 });
    expect(captured.logs).toEqual(["{ deep: [Object] }"]);
    expect(forwarded.dir).toHaveBeenCalledTimes(1);
  });

  test("captures console.table as a rendered table", () => {
    const captured = createCapturedConsole();
    captured.console.table([{ name: "db", ok: true }]);
    expect(captured.logs).toHaveLength(1);
    expect(captured.logs[0]).toContain("┌");
    expect(captured.logs[0]).toContain("name");
    expect(captured.logs[0]).toContain("'db'");
    expect(forwarded.table).toHaveBeenCalledTimes(1);
  });

  test("captures console.trace with its stack", () => {
    const captured = createCapturedConsole();
    captured.console.trace("checkpoint", 42);
    expect(captured.logs).toHaveLength(1);
    expect(captured.logs[0]).toMatch(/^\[trace\] Trace: checkpoint 42\n\s+at /);
    expect(forwarded.trace).toHaveBeenCalledWith("checkpoint", 42);
  });

  test("captures failing asserts and per-run counts only", () => {
    const captured = createCapturedConsole();
    captured.console.assert(true, "never shown");
    captured.console.assert(false, "broken invariant");
    captured.console.count("hits");
    captured.console.count("hits");
    expect(captured.logs).toEqual([
      "[assert] Assertion failed: broken invariant",
      "hits: 1",
      "hits: 2",
    ]);
    expect(forwarded.assert).toHaveBeenCalledTimes(2);

    // A fresh capture starts counting again: state is scoped to one run.
    const nextRun = createCapturedConsole();
    nextRun.console.count("hits");
    expect(nextRun.logs).toEqual(["hits: 1"]);
  });
});
