import { AsyncLocalStorage } from "node:async_hooks";
import {
  deriveParentAndRoot,
  getCorrelationId,
  getCurrentRunContext,
  withTaskRunContext,
} from "../../resources/telemetry.chain";

type Scope = ReturnType<typeof AsyncLocalStorage.snapshot>;

describe("telemetry run context", () => {
  test("nested runs chain under the outer run and share its correlation id", async () => {
    await withTaskRunContext("outer", async () => {
      const outerCorrelation = getCorrelationId();
      expect(outerCorrelation).toBeTruthy();
      await withTaskRunContext("inner", async () => {
        expect(deriveParentAndRoot("leaf")).toEqual({
          parentId: "inner",
          rootId: "outer",
        });
        expect(getCorrelationId()).toBe(outerCorrelation);
      });
    });
    expect(getCurrentRunContext()).toBeUndefined();
  });

  test("work started through a handle while the run is active still chains under it", async () => {
    let scope!: Scope;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const run = withTaskRunContext("listener-hook", async () => {
      scope = AsyncLocalStorage.snapshot();
      await gate;
    });
    expect(scope(() => deriveParentAndRoot("request"))).toEqual({
      parentId: "listener-hook",
      rootId: "listener-hook",
    });
    release();
    await run;
  });

  test("work started through a handle after the run finished opens its own chain", async () => {
    let scope!: Scope;
    let hookCorrelation: string | null = null;
    // Like an HTTP listener: the callback keeps the hook's async context.
    await withTaskRunContext("listener-hook", async () => {
      hookCorrelation = getCorrelationId();
      scope = AsyncLocalStorage.snapshot();
    });

    expect(scope(() => getCurrentRunContext())).toBeUndefined();
    expect(scope(() => getCorrelationId())).toBeNull();
    expect(scope(() => deriveParentAndRoot("request"))).toEqual({
      parentId: null,
      rootId: "request",
    });
    const requestCorrelations = await Promise.all([
      scope(() =>
        withTaskRunContext("request", async () => getCorrelationId())
      ),
      scope(() =>
        withTaskRunContext("request", async () => getCorrelationId())
      ),
    ]);
    expect(requestCorrelations[0]).toBeTruthy();
    expect(requestCorrelations[0]).not.toBe(hookCorrelation);
    expect(requestCorrelations[0]).not.toBe(requestCorrelations[1]);
  });

  test("a failed run also settles its context", async () => {
    let scope!: Scope;
    await expect(
      withTaskRunContext("failing", async () => {
        scope = AsyncLocalStorage.snapshot();
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(scope(() => getCurrentRunContext())).toBeUndefined();
  });
});
