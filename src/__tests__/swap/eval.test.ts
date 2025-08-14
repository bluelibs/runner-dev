import { run, resource } from "@bluelibs/runner";
import { resources } from "../../index";
import type { SwapManager } from "../../resources/swap.resource";
import { createDummyApp } from "../dummy/dummyApp";

describe("SwapManager.eval", () => {
  let swapManager: SwapManager;

  const probe = resource({
    id: "test.eval.probe",
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
});
