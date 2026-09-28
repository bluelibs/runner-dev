/* eslint-disable @typescript-eslint/no-require-imports */
import {
  TYPESCRIPT_MISSING_MESSAGE,
  loadTypeScript,
  typescriptIncompatibleMessage,
} from "../../resources/typescript.runtime";

type SwapTools = typeof import("../../resources/swap.tools");
type TypeScriptRuntime = typeof import("../../resources/typescript.runtime");

function moduleNotFound(): Error {
  // Same shape Node gives a require() of a package that is not installed.
  return Object.assign(new Error("Cannot find module 'typescript'"), {
    code: "MODULE_NOT_FOUND",
  });
}

/** Runs `run` in a fresh module registry where `typescript` resolves to `factory`. */
function withTypeScriptModule(factory: () => unknown, run: () => void): void {
  jest.isolateModules(() => {
    jest.doMock("typescript", factory);
    run();
  });
}

const typescriptNotInstalled = () => {
  throw moduleNotFound();
};

describe("typescript as an optional peer dependency", () => {
  afterEach(() => {
    jest.dontMock("typescript");
  });

  test("loading the package entry never requires typescript", () => {
    withTypeScriptModule(typescriptNotInstalled, () => {
      expect(() => require("../../index")).not.toThrow();
    });
  });

  test("compiling features explain how to install typescript", () => {
    withTypeScriptModule(typescriptNotInstalled, () => {
      const tools: SwapTools = require("../../resources/swap.tools");
      // A missing compiler is not a compile error in the snippet, so the
      // hint is returned without the "Compilation failed:" prefix.
      const expected = { success: false, error: TYPESCRIPT_MISSING_MESSAGE };
      expect(tools.compileRunFunction("() => 1")).toEqual(expected);
      expect(tools.compileShellFunction("1 + 1")).toEqual(expected);
    });
    expect(TYPESCRIPT_MISSING_MESSAGE).toContain("Install typescript");
    expect(TYPESCRIPT_MISSING_MESSAGE).toContain("swapTask, eval and shell");
  });

  test("compiling features report an incompatible typescript as is", () => {
    withTypeScriptModule(
      () => ({ version: "7.0.2" }),
      () => {
        const tools: SwapTools = require("../../resources/swap.tools");
        const expected = {
          success: false,
          error: typescriptIncompatibleMessage("7.0.2"),
        };
        expect(tools.compileRunFunction("() => 1")).toEqual(expected);
        expect(tools.compileShellFunction("1 + 1")).toEqual(expected);
      }
    );
  });

  test("an installed typescript without the compiler API is reported as incompatible", () => {
    withTypeScriptModule(
      () => ({ version: "7.0.2" }),
      () => {
        const runtime: TypeScriptRuntime = require("../../resources/typescript.runtime");
        expect(() => runtime.loadTypeScript()).toThrow(
          typescriptIncompatibleMessage("7.0.2")
        );
      }
    );
  });

  test("other load failures are rethrown untouched", () => {
    withTypeScriptModule(
      () => {
        throw new Error("typescript exploded while loading");
      },
      () => {
        const runtime: TypeScriptRuntime = require("../../resources/typescript.runtime");
        expect(() => runtime.loadTypeScript()).toThrow(
          "typescript exploded while loading"
        );
      }
    );
  });

  test("loads and reuses the installed compiler", () => {
    const typescript = loadTypeScript();
    expect(typeof typescript.transpileModule).toBe("function");
    expect(loadTypeScript()).toBe(typescript);
  });
});
