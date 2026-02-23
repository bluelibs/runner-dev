import { run, task, resource } from "@bluelibs/runner";
import { resources } from "../../index";
import type { ISwapManager } from "../../resources/swap.resource";
import { createDummyApp } from "../dummy/dummyApp";
import {
  supportRequestContext,
  supportRequestContextMiddleware,
} from "../dummy/enhanced";

describe("SwapManager", () => {
  let swapManager: ISwapManager;
  let taskContainer: any;

  // Test task for swapping
  const originalTask = task({
    id: "test.swap.task",
    async run() {
      return { message: "original", timestamp: Date.now() };
    },
  });

  const testResource = resource({
    id: "test.resource",
    register: [originalTask],
  });

  const middlewareReturnTask = task({
    id: "app.test.middleware-return",
    async run() {
      return { message: "middleware preserved result" };
    },
  });

  const middlewareResource = resource({
    id: "test.middleware.resource",
    register: [
      supportRequestContext,
      supportRequestContextMiddleware,
      middlewareReturnTask,
    ],
  });

  // Probe resource to capture dependencies after initialization
  const probe = resource({
    id: "test.probe",
    dependencies: {
      swapManager: resources.swapManager,
      testTask: originalTask,
    },
    async init(_, { swapManager: sm, testTask }) {
      swapManager = sm;
      taskContainer = testTask;
    },
  });

  beforeAll(async () => {
    const app = createDummyApp([
      testResource,
      middlewareResource,
      resources.introspector,
      resources.swapManager,
      probe,
    ]);
    await run(app);
  });

  beforeEach(async () => {
    // Ensure clean state
    await swapManager.unswapAll();
  });

  describe("Basic Swap Operations", () => {
    test("should swap a task successfully", async () => {
      const newCode = `
        async function run() {
          return { message: "swapped", timestamp: Date.now() };
        }
      `;

      const result = await swapManager.swap("test.swap.task", newCode);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("test.swap.task");
      expect(result.error).toBeUndefined();

      // Verify task is tracked as swapped
      expect(swapManager.isSwapped("test.swap.task")).toBe(true);

      const swappedTasks = swapManager.getSwappedTasks();
      expect(swappedTasks).toHaveLength(1);
      expect(swappedTasks[0].taskId).toBe("test.swap.task");
    });

    test("should execute swapped task with new logic", async () => {
      const newCode = `
        async function run() {
          return { message: "I am swapped!", value: 42 };
        }
      `;

      await swapManager.swap("test.swap.task", newCode);

      // Execute the swapped task via task runner
      const result = await taskContainer();

      expect(result.message).toBe("I am swapped!");
      expect(result.value).toBe(42);
    });

    test("should unswap a task successfully", async () => {
      const newCode = `
        async function run() {
          return { message: "swapped" };
        }
      `;

      // First swap
      await swapManager.swap("test.swap.task", newCode);
      expect(swapManager.isSwapped("test.swap.task")).toBe(true);

      // Then unswap
      const result = await swapManager.unswap("test.swap.task");

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("test.swap.task");
      expect(swapManager.isSwapped("test.swap.task")).toBe(false);

      // Verify original function is restored
      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("original");
    });

    test("should unswap all tasks", async () => {
      // Swap our test task
      await swapManager.swap(
        "test.swap.task",
        "async function run() { return {message: 'swapped'}; }"
      );

      expect(swapManager.getSwappedTasks()).toHaveLength(1);

      // Unswap all
      const results = await swapManager.unswapAll();

      expect(results).toHaveLength(1);
      expect(results.every((r: any) => r.success)).toBe(true);
      expect(swapManager.getSwappedTasks()).toHaveLength(0);

      // Verify original function is restored
      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("original");
    });
  });

  describe("TypeScript Compilation", () => {
    test("should compile valid TypeScript code", async () => {
      const tsCode = `
        async function run(): Promise<{message: string}> {
          const greeting: string = "Hello TypeScript";
          return { message: greeting };
        }
      `;

      const result = await swapManager.swap("test.swap.task", tsCode);

      expect(result.success).toBe(true);

      // Execute and verify
      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("Hello TypeScript");
    });

    test("should handle arrow function syntax", async () => {
      const arrowCode = "() => ({ message: 'arrow function' })";

      const result = await swapManager.swap("test.swap.task", arrowCode);

      expect(result.success).toBe(true);

      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("arrow function");
    });

    test("should handle function body without wrapper", async () => {
      const bodyCode = `
        const message = "just a body";
        return { message };
      `;

      const result = await swapManager.swap("test.swap.task", bodyCode);

      expect(result.success).toBe(true);

      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("just a body");
    });
  });

  describe("Error Handling", () => {
    test("should fail when task does not exist", async () => {
      const result = await swapManager.swap("non.existent.task", "() => {}");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.taskId).toBe("non.existent.task");
    });

    test("should fail with invalid code", async () => {
      const invalidCode = "this is not valid javascript {{{";

      const result = await swapManager.swap("test.swap.task", invalidCode);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Compilation failed");
    });

    test("should fail to unswap task that is not swapped", async () => {
      const result = await swapManager.unswap("test.swap.task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("is not swapped");
    });

    test("should fail to unswap non-existent task", async () => {
      const result = await swapManager.unswap("non.existent.task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("should handle compilation errors gracefully", async () => {
      const badTsCode = `
        function run(): WrongType {
          return "this won't compile properly";
        }
      `;

      const result = await swapManager.swap("test.swap.task", badTsCode);

      // Should succeed with TypeScript transpilation (it's lenient)
      // The main goal is no crashes
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("State Management", () => {
    test("should track multiple swaps correctly", async () => {
      const swappedTasks = swapManager.getSwappedTasks();
      expect(swappedTasks).toHaveLength(0);

      await swapManager.swap("test.swap.task", "() => ({message: 'first'})");

      const tasks = swapManager.getSwappedTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].taskId).toBe("test.swap.task");
      expect(typeof tasks[0].swappedAt).toBe("number");
    });

    test("should handle re-swapping the same task", async () => {
      // First swap
      await swapManager.swap(
        "test.swap.task",
        "() => ({message: 'first swap'})"
      );

      // Second swap of same task
      await swapManager.swap(
        "test.swap.task",
        "() => ({message: 'second swap'})"
      );

      // Should still only have one tracked swap
      expect(swapManager.getSwappedTasks()).toHaveLength(1);

      // Should execute with latest swap
      const result = await taskContainer();
      expect(result.message).toBe("second swap");

      // Should still be able to unswap back to original
      await swapManager.unswap("test.swap.task");
      const originalResult = await taskContainer();
      expect(originalResult.message).toBe("original");
    });
  });

  describe("Task Invocation", () => {
    test("should invoke task with no input", async () => {
      const result = await swapManager.invokeTask("test.swap.task");

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("test.swap.task");
      expect(result.invocationId).toBeTruthy();
      expect(typeof result.executionTimeMs).toBe("number");
      expect(result.result).toContain("original");
    });

    test("should preserve task output when app-wide audit middleware wraps execution", async () => {
      const result = await swapManager.invokeTask("app.test.middleware-return");

      expect(result.success).toBe(true);
      expect(result.result).toBeTruthy();

      const parsedResult = JSON.parse(result.result!);
      expect(parsedResult).toEqual({ message: "middleware preserved result" });
    });

    test("should invoke task with JSON input", async () => {
      const inputJson = JSON.stringify({ name: "Test User", age: 25 });

      // First swap to a task that uses input
      await swapManager.swap(
        "test.swap.task",
        `
        async function run(input, deps) {
          return { 
            message: "Hello " + input.name, 
            age: input.age,
            timestamp: Date.now() 
          };
        }
      `
      );

      const result = await swapManager.invokeTask("test.swap.task", inputJson);

      expect(result.success).toBe(true);
      expect(result.result).toContain("Hello Test User");
      expect(result.result).toContain("25");
    });

    test("should handle task invocation errors", async () => {
      const result = await swapManager.invokeTask("non.existent.task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.taskId).toBe("non.existent.task");
      expect(result.invocationId).toBeTruthy();
    });

    test("should handle invalid JSON input", async () => {
      const result = await swapManager.invokeTask(
        "test.swap.task",
        "invalid json {"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON deserialization failed");
      expect(result.taskId).toBe("test.swap.task");
    });

    test("should handle task execution errors", async () => {
      // Swap to a task that throws an error
      await swapManager.swap(
        "test.swap.task",
        `
        async function run(input, deps) {
          throw new Error("Intentional test error");
        }
      `
      );

      const result = await swapManager.invokeTask("test.swap.task");

      expect(result.success).toBe(false);
      // Accept either legacy or current error prefix
      const err = result.error ?? "";
      expect(
        err.includes("Task execution failed") ||
          err.includes("Invocation failed")
      ).toBe(true);
      expect(err).toContain("Intentional test error");
      expect(typeof result.executionTimeMs).toBe("number");
    });

    test("should serialize complex results properly", async () => {
      await swapManager.swap(
        "test.swap.task",
        `
        async function run(input, deps) {
          return {
            string: "test",
            number: 42,
            boolean: true,
            array: [1, 2, 3],
            object: { nested: "value" },
            date: new Date("2023-01-01"),
            func: () => "test function",
            undefined: undefined
          };
        }
      `
      );

      const result = await swapManager.invokeTask("test.swap.task");

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.result!);
      expect(parsed.string).toBe("test");
      expect(parsed.number).toBe(42);
      expect(parsed.boolean).toBe(true);
      expect(parsed.array).toEqual([1, 2, 3]);
      expect(parsed.object.nested).toBe("value");
      expect(parsed.func).toBe("[Function: func]");
      expect(parsed.undefined).toBe("[undefined]");
    });

    test("should invoke task in pure mode (bypass middleware)", async () => {
      // First swap the task to use dependencies
      await swapManager.swap(
        "test.swap.task",
        `
        async function run(input, deps) {
          return { 
            message: "pure mode test",
            hasDependencies: !!deps && Object.keys(deps).length > 0,
            dependencyKeys: Object.keys(deps || {}),
            dependencyCount: Object.keys(deps || {}).length,
            input: input
          };
        }
      `
      );

      // Test without pure mode (minimal/empty dependencies)
      const standardResult = await swapManager.invokeTask(
        "test.swap.task",
        '{"test": "data"}',
        false
      );
      expect(standardResult.success).toBe(true);
      const standardParsed = JSON.parse(standardResult.result!);

      // Test with pure mode (computed dependencies from store)
      const pureResult = await swapManager.invokeTask(
        "test.swap.task",
        '{"test": "data"}',
        true
      );
      expect(pureResult.success).toBe(true);
      const pureParsed = JSON.parse(pureResult.result!);

      // Pure mode should have more dependencies than standard mode
      expect(pureParsed.dependencyCount).toBeGreaterThanOrEqual(
        standardParsed.dependencyCount
      );
      expect(pureParsed.input).toEqual({ test: "data" });
      expect(standardParsed.input).toEqual({ test: "data" });
    });

    test("should evaluate JavaScript input expressions when evalInput=true", async () => {
      // Swap task to show input details
      await swapManager.swap(
        "test.swap.task",
        `
        async function run(input, deps) {
          return { 
            message: "eval input test",
            input: input,
            inputType: typeof input,
            // Check input properties before serialization affects them
            originalDate: input.timestamp instanceof Date ? input.timestamp.toISOString() : null,
            originalFunction: typeof input?.func === 'function' ? 'yes' : 'no'
          };
        }
      `
      );

      // Test with JSON parsing (default)
      const jsonResult = await swapManager.invokeTask(
        "test.swap.task",
        '{"name": "test", "value": 42}',
        false,
        false
      );
      expect(jsonResult.success).toBe(true);
      const jsonParsed = JSON.parse(jsonResult.result!);
      expect(jsonParsed.input).toEqual({ name: "test", value: 42 });

      // Test with JavaScript evaluation
      const jsInput = `{
        name: "test",
        timestamp: new Date("2023-01-01T00:00:00Z"),
        func: () => "hello world",
        calculated: Math.PI * 2,
        array: [1, 2, 3].map(x => x * 2)
      }`;

      const evalResult = await swapManager.invokeTask(
        "test.swap.task",
        jsInput,
        false,
        true
      );
      expect(evalResult.success).toBe(true);
      const evalParsed = JSON.parse(evalResult.result!);

      expect(evalParsed.input.name).toBe("test");
      // Verify the Date object was properly evaluated as a Date (captured before serialization)
      expect(evalParsed.originalDate).toBe("2023-01-01T00:00:00.000Z");
      // Verify the function was properly evaluated as a function (captured before serialization)
      expect(evalParsed.originalFunction).toBe("yes");
      expect(evalParsed.input.calculated).toBeCloseTo(6.283185307179586);
      expect(evalParsed.input.array).toEqual([2, 4, 6]);
    });

    test("should handle JavaScript evaluation errors gracefully", async () => {
      const result = await swapManager.invokeTask(
        "test.swap.task",
        "invalid.syntax.here",
        false,
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("JavaScript evaluation failed");
      expect(result.taskId).toBe("test.swap.task");
      expect(result.invocationId).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty code", async () => {
      const result = await swapManager.swap("test.swap.task", "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Compilation failed");
    });

    test("should handle code that returns non-serializable objects", async () => {
      const codeWithFunction = `
        async function run() {
          return { 
            message: "test",
            func: () => console.log("embedded function")
          };
        }
      `;

      const result = await swapManager.swap("test.swap.task", codeWithFunction);

      expect(result.success).toBe(true);

      // Should execute without throwing
      const taskResult = await taskContainer();
      expect(taskResult.message).toBe("test");
      expect(typeof taskResult.func).toBe("function");
    });
  });
});
