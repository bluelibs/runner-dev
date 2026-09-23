import { run, defineResource } from "@bluelibs/runner";
import { resources } from "../../index";
import type { ISwapManager } from "../../resources/swap.resource";
import {
  SHELL_TIMEOUT_ENV_VAR,
  executionTimeoutMessage,
} from "../../resources/shell.timeout";
import { MAX_SHELL_RESULT_CHARS } from "../../resources/swap.tools";
import { createDummyApp } from "../dummy/dummyApp";
import { withEnvAsync } from "./withEnv";

describe("SwapManager.eval", () => {
  let swapManager: ISwapManager;

  const probe = defineResource({
    id: "test-eval-probe",
    dependencies: { swapManager: resources.swapManager },
    async init(_c, { swapManager: sm }) {
      swapManager = sm;
    },
  });

  beforeAll(async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.swapManager,
      probe,
    ]);
    await run(app);
  });

  test("evaluates simple arrow function", async () => {
    const res = await swapManager.runnerEval("() => ({ message: 'hi' })");
    expect(res.success).toBe(true);
    expect(res.result).toBeTruthy();
    const parsed = JSON.parse(res.result!);
    expect(parsed.message).toBe("hi");
  });

  test("evaluates function body and returns structured data", async () => {
    const code = `
      const now = 123;
      return { ok: true, now };
    `;
    const res = await swapManager.runnerEval(code);
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.result!);
    expect(parsed.ok).toBe(true);
    expect(parsed.now).toBe(123);
  });

  test("passes input via JSON parse", async () => {
    const code = `async function run(deps){ return { store: Boolean(deps.store), introspector: Boolean(deps.introspector), globals: Boolean(deps.globals) } }`;
    const res = await swapManager.runnerEval(code);
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.result!);
    expect(parsed).toEqual({
      store: true,
      introspector: true,
      globals: true,
    });
  });

  test("exposes dependencies bag (store, introspector, globals)", async () => {
    const code = `
      async function run(deps){
        return {
          hasStore: !!deps.store,
          hasIntrospector: !!deps.introspector,
        }
      }
    `;
    const res = await swapManager.runnerEval(code);
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.result!);
    expect(parsed.hasStore).toBe(true);
    expect(parsed.hasIntrospector).toBe(true);
  });

  test("handles compilation errors gracefully", async () => {
    const res = await swapManager.runnerEval("this is not valid {{{");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Compilation failed");
  });

  test("handles execution errors gracefully", async () => {
    const res = await swapManager.runnerEval(
      `async function run(){ throw new Error('boom'); }`
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("Evaluation execution failed");
    expect(res.error).toContain("boom");
  });

  describe("limits shared with the shell", () => {
    test("answers with a timeout error instead of hanging", () =>
      withEnvAsync({ [SHELL_TIMEOUT_ENV_VAR]: "50" }, async () => {
        const res = await swapManager.runnerEval(
          `async function run(){ await new Promise(() => {}); }`
        );
        expect(res.success).toBe(false);
        expect(res.error).toBe(executionTimeoutMessage("Eval", 50));
        expect(res.executionTimeMs).toBeGreaterThanOrEqual(45);
        expect(res.invocationId).toBeTruthy();
      }));

    test("fails fast on a malformed timeout before running code", () =>
      withEnvAsync({ [SHELL_TIMEOUT_ENV_VAR]: "soon" }, async () => {
        const ran = jest.fn();
        (globalThis as { __evalLimitProbe?: () => void }).__evalLimitProbe =
          ran;
        try {
          const res = await swapManager.runnerEval(
            `async function run(){ globalThis.__evalLimitProbe(); return 1; }`
          );
          expect(res.success).toBe(false);
          expect(res.error).toContain(
            `Invalid ${SHELL_TIMEOUT_ENV_VAR}="soon"`
          );
          expect(ran).not.toHaveBeenCalled();
        } finally {
          delete (globalThis as { __evalLimitProbe?: () => void })
            .__evalLimitProbe;
        }
      }));

    test("truncates oversized results with an explicit marker", async () => {
      const res = await swapManager.runnerEval(
        `async function run(){ return "z".repeat(${
          MAX_SHELL_RESULT_CHARS + 10
        }); }`
      );
      expect(res.success).toBe(true);
      // serializeResult JSON-encodes the string, adding two quotes: the kept
      // prefix is the opening quote plus MAX - 1 chars, and 12 chars are cut.
      const marker = "… [truncated 12 chars]";
      expect(res.result?.length).toBe(MAX_SHELL_RESULT_CHARS + marker.length);
      expect(res.result?.startsWith('"zzz')).toBe(true);
      expect(res.result?.endsWith(`z${marker}`)).toBe(true);
    });
  });
});
