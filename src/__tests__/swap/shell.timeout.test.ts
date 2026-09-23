import { run, defineResource } from "@bluelibs/runner";
import { resources } from "../../index";
import type { ISwapManager } from "../../resources/swap.resource";
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  SHELL_TIMEOUT_ENV_VAR,
  raceShellTimeout,
  resolveShellTimeoutMs,
  shellTimeoutMessage,
} from "../../resources/shell.timeout";
import {
  MAX_SHELL_RESULT_CHARS,
  serializeShellResult,
  truncateWithMarker,
} from "../../resources/swap.tools";
import { createDummyApp } from "../dummy/dummyApp";
import { withEnv, withEnvAsync } from "./withEnv";

describe("resolveShellTimeoutMs", () => {
  test.each([undefined, "", "   "])("defaults for %p", (rawValue) => {
    expect(resolveShellTimeoutMs(rawValue)).toBe(DEFAULT_SHELL_TIMEOUT_MS);
  });

  test("parses whole milliseconds", () => {
    expect(resolveShellTimeoutMs(" 5000 ")).toBe(5000);
  });

  test.each(["0", "-1", "abc", "1.5", "1e3", "2147483648"])(
    "rejects %p instead of guessing",
    (rawValue) => {
      expect(() => resolveShellTimeoutMs(rawValue)).toThrow(
        `Invalid ${SHELL_TIMEOUT_ENV_VAR}="${rawValue}"`
      );
    }
  );

  test("reads the env var by default", () => {
    withEnv({ [SHELL_TIMEOUT_ENV_VAR]: "1234" }, () => {
      expect(resolveShellTimeoutMs()).toBe(1234);
    });
  });
});

describe("raceShellTimeout", () => {
  test("returns the value when execution finishes first", async () => {
    await expect(raceShellTimeout(Promise.resolve(7), 1000)).resolves.toEqual({
      timedOut: false,
      value: 7,
    });
  });

  test("reports a timeout when execution never settles", async () => {
    const never = new Promise<never>(() => undefined);
    await expect(raceShellTimeout(never, 10)).resolves.toEqual({
      timedOut: true,
    });
  });

  test("propagates execution failures", async () => {
    await expect(
      raceShellTimeout(Promise.reject(new Error("boom")), 1000)
    ).rejects.toThrow("boom");
  });

  test("explains that the snippet may still be running", () => {
    const message = shellTimeoutMessage(50);
    expect(message).toContain("timed out after 50 ms");
    expect(message).toContain("may still be running");
    expect(message).toContain(SHELL_TIMEOUT_ENV_VAR);
  });
});

describe("shell result cap", () => {
  test("truncateWithMarker keeps short text and marks cuts", () => {
    expect(truncateWithMarker("short", 10)).toBe("short");
    expect(truncateWithMarker("0123456789", 4)).toBe(
      "0123… [truncated 6 chars]"
    );
  });

  test("serializeShellResult caps huge strings and objects", () => {
    const overflow = 1000;
    const huge = "y".repeat(MAX_SHELL_RESULT_CHARS + overflow);
    expect(serializeShellResult(huge)).toBe(
      `${"y".repeat(MAX_SHELL_RESULT_CHARS)}… [truncated ${overflow} chars]`
    );

    const serializedObject = serializeShellResult({ blob: huge });
    expect(serializedObject.startsWith('{\n  "blob": "yyy')).toBe(true);
    expect(serializedObject).toMatch(/… \[truncated \d+ chars\]$/);
  });
});

describe("SwapManager.shell limits", () => {
  let swapManager: ISwapManager;

  const probe = defineResource({
    id: "test-shell-limits-probe",
    dependencies: { swapManager: resources.swapManager },
    async init(_config, { swapManager: manager }) {
      swapManager = manager;
    },
  });

  beforeAll(async () => {
    await run(
      createDummyApp([resources.introspector, resources.swapManager, probe])
    );
  });

  beforeEach(() => {
    jest.spyOn(globalThis.console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("answers with a timeout error while keeping logs so far", () =>
    withEnvAsync({ [SHELL_TIMEOUT_ENV_VAR]: "50" }, async () => {
      const res = await swapManager.shell(
        `console.log("started");\nawait new Promise(() => {});`
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe(shellTimeoutMessage(50));
      expect(res.logs).toEqual(["started"]);
      expect(res.executionTimeMs).toBeGreaterThanOrEqual(45);
      expect(res.invocationId).toBeTruthy();
    }));

  test("fails fast on a malformed timeout before running code", () =>
    withEnvAsync({ [SHELL_TIMEOUT_ENV_VAR]: "soon" }, async () => {
      const res = await swapManager.shell(`console.log("ran"); return 1;`);
      expect(res.success).toBe(false);
      expect(res.error).toContain(`Invalid ${SHELL_TIMEOUT_ENV_VAR}="soon"`);
      expect(res.logs).toBeUndefined();
    }));

  test("truncates oversized results with an explicit marker", async () => {
    const res = await swapManager.shell(
      `"z".repeat(${MAX_SHELL_RESULT_CHARS + 10})`
    );
    expect(res.success).toBe(true);
    expect(res.result).toBe(
      `${"z".repeat(MAX_SHELL_RESULT_CHARS)}… [truncated 10 chars]`
    );
  });
});
