import { run, defineResource } from "@bluelibs/runner";
import { resources } from "../../index";
import type { ISwapManager } from "../../resources/swap.resource";
import {
  compileShellFunction,
  completeShellScope,
  extractCompletionTarget,
  serializeShellResult,
} from "../../resources/swap.tools";
import { createDummyApp } from "../dummy/dummyApp";

describe("SwapManager.shell", () => {
  let swapManager: ISwapManager;

  const probe = defineResource({
    id: "test-shell-probe",
    dependencies: { swapManager: resources.swapManager },
    async init(_c, { swapManager: sm }) {
      swapManager = sm;
    },
  });

  const dupParentA = defineResource({
    id: "test-shell-dup-a",
    register: [
      defineResource<void, Promise<{ side: string }>>({
        id: "test-shell-dup",
        async init() {
          return { side: "a" };
        },
      }),
    ],
  });

  const dupParentB = defineResource({
    id: "test-shell-dup-b",
    register: [
      defineResource<void, Promise<{ side: string }>>({
        id: "test-shell-dup",
        async init() {
          return { side: "b" };
        },
      }),
    ],
  });

  beforeAll(async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.swapManager,
      dupParentA,
      dupParentB,
      probe,
    ]);
    await run(app);
  });

  test("binds r to the initialized resource value", async () => {
    const res = await swapManager.shell("r", "res-db");
    expect(res.success).toBe(true);
    expect(res.result).toContain("memory://");
  });

  test("resolves resources by suffix id", async () => {
    const res = await swapManager.shell("r.ttlMs", "res-cache");
    expect(res.success).toBe(true);
    expect(res.result).toBe("1000");
  });

  test("auto-returns bare expressions", async () => {
    const res = await swapManager.shell("1 + 2");
    expect(res.success).toBe(true);
    expect(res.result).toBe("3");
  });

  test("supports await in bare expressions", async () => {
    const res = await swapManager.shell(`await runtime.runTask("task-hello")`);
    expect(res.success).toBe(true);
    expect(res.result).toBe("ok");
  });

  test("supports multi-statement bodies with return", async () => {
    const res = await swapManager.shell(
      `const value = await runtime.getResourceValue("res-db");\nreturn value.url;`
    );
    expect(res.success).toBe(true);
    expect(res.result).toBe("memory://");
  });

  test("exposes the runtime surface", async () => {
    const res = await swapManager.shell(
      `typeof runtime.runTask === "function" && typeof runtime.emitEvent === "function" && typeof runtime.getResourceValue === "function"`
    );
    expect(res.success).toBe(true);
    expect(res.result).toBe("true");
  });

  test("reads resource config through the runtime", async () => {
    const res = await swapManager.shell(
      `runtime.getResourceConfig("res-cache")`
    );
    expect(res.success).toBe(true);
    expect(res.result).toContain("1000");
  });

  test("captures console output without failing the run", async () => {
    const res = await swapManager.shell(
      `console.log("hi", { answer: 42 });\nreturn "done";`
    );
    expect(res.success).toBe(true);
    expect(res.result).toBe("done");
    expect(res.logs).toHaveLength(1);
    expect(res.logs![0]).toContain("hi");
    expect(res.logs![0]).toContain("42");
  });

  test("keeps logs when execution throws", async () => {
    const res = await swapManager.shell(
      `console.log("before boom");\nthrow new Error("boom");`
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("Shell execution failed");
    expect(res.error).toContain("boom");
    expect(res.logs).toEqual(["before boom"]);
  });

  test("leaves r null without a resource scope", async () => {
    const res = await swapManager.shell("r");
    expect(res.success).toBe(true);
    expect(res.result).toBe("null");
  });

  test("reports unknown resources", async () => {
    const res = await swapManager.shell("r", "no-such-resource");
    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
  });

  test("reports ambiguous resources", async () => {
    const res = await swapManager.shell("r", "test-shell-dup");
    expect(res.success).toBe(false);
    expect(res.error).toContain("ambiguous");
  });

  test("handles empty code", async () => {
    const res = await swapManager.shell("   ");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Code cannot be empty");
  });

  test("handles compilation errors gracefully", async () => {
    const res = await swapManager.shell("this is not valid {{{");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Compilation failed");
  });

  test("reports invocation metadata", async () => {
    const res = await swapManager.shell("true");
    expect(res.success).toBe(true);
    expect(typeof res.executionTimeMs).toBe("number");
    expect(res.invocationId).toBeTruthy();
  });
});

describe("compileShellFunction", () => {
  test("compiles expressions with destructured scope", async () => {
    const compiled = compileShellFunction("r + 1");
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    await expect(compiled.func({ r: 41 })).resolves.toBe(42);
  });

  test("compiles bodies with return", async () => {
    const compiled = compileShellFunction(`const x = 1;\nreturn x + 1;`);
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    await expect(compiled.func({})).resolves.toBe(2);
  });

  test("rejects invalid code", () => {
    const compiled = compileShellFunction("this is not valid {{{");
    expect(compiled.success).toBe(false);
  });

  test("auto-returns expressions that end with a line comment", async () => {
    const withComment = compileShellFunction("r // check");
    expect(withComment.success).toBe(true);
    if (!withComment.success) return;
    await expect(withComment.func({ r: "value" })).resolves.toBe("value");

    const arithmetic = compileShellFunction("1 + 2 // note");
    expect(arithmetic.success).toBe(true);
    if (!arithmetic.success) return;
    await expect(arithmetic.func({})).resolves.toBe(3);
  });
});

describe("serializeShellResult", () => {
  test("keeps class instances inspectable", () => {
    class Service {
      public name = "db";
    }
    expect(serializeShellResult(new Service())).toContain("db");
  });

  test("handles circular structures", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(serializeShellResult(value)).toContain("[Circular]");
  });

  test("keeps Map and Set entries", () => {
    expect(serializeShellResult(new Map([["k", "v"]]))).toContain("v");
    expect(serializeShellResult(new Set(["v"]))).toContain("v");
  });

  test("serializes errors with message", () => {
    expect(serializeShellResult(new Error("nope"))).toContain("nope");
  });

  test("passes strings through and marks undefined", () => {
    expect(serializeShellResult("plain")).toBe("plain");
    expect(serializeShellResult(undefined)).toBe("undefined");
  });
});

describe("SwapManager.completeShell", () => {
  let completionManager: ISwapManager;

  const completionProbe = defineResource({
    id: "test-shell-complete-probe",
    dependencies: { swapManager: resources.swapManager },
    async init(_c, { swapManager: sm }) {
      completionManager = sm;
    },
  });

  beforeAll(async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.swapManager,
      completionProbe,
    ]);
    await run(app);
  });

  test("completes runtime members", async () => {
    const code = "runtime.run";
    const res = await completionManager.completeShell(code, code.length);
    expect(res.from).toBe("runtime.".length);
    const labels = res.options.map((o) => o.label);
    expect(labels).toContain("runTask");
    expect(labels).not.toContain("emitEvent");
    const runTask = res.options.find((o) => o.label === "runTask");
    expect(runTask?.type).toBe("method");
  });

  test("completes resource value members for r", async () => {
    const code = "r.";
    const res = await completionManager.completeShell(
      code,
      code.length,
      "res-db"
    );
    expect(res.from).toBe(code.length);
    expect(res.options.map((o) => o.label)).toContain("url");
  });

  test("completes scope roots for bare words", async () => {
    const code = "run";
    const res = await completionManager.completeShell(code, code.length);
    expect(res.from).toBe(0);
    expect(res.options.map((o) => o.label)).toContain("runtime");
  });

  test("yields no options for unknown resources", async () => {
    const code = "r.";
    const res = await completionManager.completeShell(
      code,
      code.length,
      "no-such-resource"
    );
    expect(res.options).toEqual([]);
  });

  test("yields no options without a target", async () => {
    const res = await completionManager.completeShell("   ", 3);
    expect(res.options).toEqual([]);
  });
});

describe("extractCompletionTarget", () => {
  test("extracts dotted paths with prefix", () => {
    expect(extractCompletionTarget("runtime.run", 11)).toEqual({
      objectPath: ["runtime"],
      prefix: "run",
      from: 8,
    });
  });

  test("extracts empty prefixes after a dot", () => {
    expect(extractCompletionTarget("r.", 2)).toEqual({
      objectPath: ["r"],
      prefix: "",
      from: 2,
    });
  });

  test("extracts nested paths", () => {
    expect(extractCompletionTarget("r.db.u", 6)).toEqual({
      objectPath: ["r", "db"],
      prefix: "u",
      from: 5,
    });
  });

  test("treats bare words as scope roots", () => {
    expect(extractCompletionTarget("run", 3)).toEqual({
      objectPath: [],
      prefix: "run",
      from: 0,
    });
  });

  test("rejects calls, brackets, and operators", () => {
    expect(extractCompletionTarget(`f("x").`, 6)).toBeNull();
    expect(extractCompletionTarget("a[0].", 5)).toBeNull();
    expect(extractCompletionTarget("a + b", 5)).toEqual({
      objectPath: [],
      prefix: "b",
      from: 4,
    });
  });

  test("rejects trailing whitespace", () => {
    expect(extractCompletionTarget("runtime ", 8)).toBeNull();
  });

  test("rejects strings and line comments", () => {
    expect(extractCompletionTarget(`"run`, 4)).toBeNull();
    expect(extractCompletionTarget("// run", 6)).toBeNull();
  });

  test("clamps out-of-range positions", () => {
    expect(extractCompletionTarget("r", 99)?.from).toBe(0);
  });
});

describe("completeShellScope", () => {
  const scope = {
    runtime: {
      runTask: async () => "ok",
      state: "running",
      nested: { deep: 1 },
    },
    r: null,
  };

  test("completes scope roots", () => {
    const options = completeShellScope(scope, {
      objectPath: [],
      prefix: "r",
      from: 0,
    });
    expect(options.map((o) => o.label).sort()).toEqual(["r", "runtime"]);
    expect(options.find((o) => o.label === "r")?.type).toBe("variable");
  });

  test("completes members with kinds and details", () => {
    const options = completeShellScope(scope, {
      objectPath: ["runtime"],
      prefix: "",
      from: 8,
    });
    const labels = options.map((o) => o.label);
    expect(labels).toContain("runTask");
    expect(labels).toContain("state");
    expect(options.find((o) => o.label === "runTask")?.type).toBe("method");
    expect(options.find((o) => o.label === "state")?.detail).toContain(
      "running"
    );
  });

  test("walks nested paths", () => {
    const options = completeShellScope(scope, {
      objectPath: ["runtime", "nested"],
      prefix: "",
      from: 0,
    });
    expect(options.map((o) => o.label)).toEqual(["deep"]);
  });

  test("returns nothing for missing paths", () => {
    expect(
      completeShellScope(scope, {
        objectPath: ["r"],
        prefix: "",
        from: 0,
      })
    ).toEqual([]);
    expect(
      completeShellScope(scope, {
        objectPath: ["nope"],
        prefix: "",
        from: 0,
      })
    ).toEqual([]);
  });

  test("lists getters without invoking them", () => {
    let getterCalls = 0;
    const tricky = {
      get boom(): unknown {
        getterCalls += 1;
        throw new Error("getter boom");
      },
    };
    const options = completeShellScope(tricky, {
      objectPath: [],
      prefix: "",
      from: 0,
    });
    expect(options.map((o) => o.label)).toEqual(["boom"]);
    expect(options[0].detail).toBeUndefined();
    expect(getterCalls).toBe(0);
  });

  test("does not traverse through accessors", () => {
    let getterCalls = 0;
    const tricky = {
      get nested(): unknown {
        getterCalls += 1;
        return { deep: 1 };
      },
    };
    expect(
      completeShellScope(tricky, {
        objectPath: ["nested"],
        prefix: "",
        from: 0,
      })
    ).toEqual([]);
    expect(getterCalls).toBe(0);
  });

  test("walks the full prototype chain", () => {
    class Grandparent {
      grandMethod() {
        return "grand";
      }
    }
    class Parent extends Grandparent {
      parentMethod() {
        return "parent";
      }
    }
    const options = completeShellScope(
      { child: new Parent() },
      { objectPath: ["child"], prefix: "", from: 0 }
    );
    const labels = options.map((o) => o.label);
    expect(labels).toContain("parentMethod");
    expect(labels).toContain("grandMethod");
    expect(labels).not.toContain("hasOwnProperty");
  });

  test("exposes prototype members without Object noise", () => {
    const options = completeShellScope(
      { m: new Map() },
      {
        objectPath: ["m"],
        prefix: "",
        from: 0,
      }
    );
    const labels = options.map((o) => o.label);
    expect(labels).toContain("set");
    expect(labels).not.toContain("hasOwnProperty");
  });
});
