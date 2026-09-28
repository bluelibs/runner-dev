import {
  run,
  defineTask,
  defineResource,
  defineEvent,
  defineHook,
  resources as runnerResources,
} from "@bluelibs/runner";
import { ApolloServer } from "@apollo/server";
import { resources } from "../../index";
import { telemetry } from "../../resources/telemetry.resource";
import type { CustomGraphQLContext } from "../../schema/context";
import type { SwapResult, SwappedTask } from "../../generated/resolvers-types";
import { createDummyApp, dummyAppIds } from "../dummy/dummyApp";

// Helper functions for type-safe test assertions
function assertSwapResult(data: unknown): asserts data is SwapResult {
  if (!data || typeof data !== "object") {
    throw new Error("Expected SwapResult object");
  }
}

function assertSwappedTaskArray(data: unknown): asserts data is SwappedTask[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected SwappedTask array");
  }
}

function assertSwapResultArray(data: unknown): asserts data is SwapResult[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected SwapResult array");
  }
}

function assertLiveData(
  data: unknown
): asserts data is { live: { logs: any[] } } {
  if (!data || typeof data !== "object" || !("live" in data)) {
    throw new Error("Expected live data object");
  }
}

function assertTaskData(
  data: unknown
): asserts data is { task: { id: string } } {
  if (!data || typeof data !== "object" || !("task" in data)) {
    throw new Error("Expected task data object");
  }
}

function assertSwapTaskData(
  data: unknown
): asserts data is { swapTask: SwapResult } {
  if (!data || typeof data !== "object" || !("swapTask" in data)) {
    throw new Error("Expected swapTask data object");
  }
}

function assertInvokeTaskData(
  data: unknown
): asserts data is { invokeTask: any } {
  if (!data || typeof data !== "object" || !("invokeTask" in data)) {
    throw new Error("Expected invokeTask data object");
  }
}

function assertInvokeEventData(
  data: unknown
): asserts data is { invokeEvent: any } {
  if (!data || typeof data !== "object" || !("invokeEvent" in data)) {
    throw new Error("Expected invokeEvent data object");
  }
}

type ShellMutationData = {
  shell: {
    success: boolean;
    error?: string | null;
    result?: string | null;
    logs?: Array<string | null> | null;
    executionTimeMs?: number | null;
    invocationId?: string | null;
  };
};

type ShellCompleteQueryData = {
  shellComplete: {
    from: number;
    options: Array<{
      label: string;
      type?: string | null;
      detail?: string | null;
    }>;
  };
};

function assertShellEnabledData(
  data: unknown
): asserts data is { shellEnabled: boolean } {
  if (!data || typeof data !== "object" || !("shellEnabled" in data)) {
    throw new Error("Expected shellEnabled data object");
  }
}

function assertShellData(data: unknown): asserts data is ShellMutationData {
  if (!data || typeof data !== "object" || !("shell" in data)) {
    throw new Error("Expected shell data object");
  }
}

function assertShellCompleteData(
  data: unknown
): asserts data is ShellCompleteQueryData {
  if (!data || typeof data !== "object" || !("shellComplete" in data)) {
    throw new Error("Expected shellComplete data object");
  }
}

type ShellEnvSnapshot = {
  RUNNER_DEV_EVAL: string | undefined;
  NODE_ENV: string | undefined;
};

function captureShellEnv(): ShellEnvSnapshot {
  return {
    RUNNER_DEV_EVAL: process.env.RUNNER_DEV_EVAL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function restoreShellEnv(previous: ShellEnvSnapshot): void {
  if (previous.RUNNER_DEV_EVAL === undefined) {
    delete process.env.RUNNER_DEV_EVAL;
  } else {
    process.env.RUNNER_DEV_EVAL = previous.RUNNER_DEV_EVAL;
  }
  if (previous.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previous.NODE_ENV;
  }
}

describe("Swap GraphQL Integration", () => {
  let _testApp: any;
  let apolloServer: ApolloServer;
  let context: CustomGraphQLContext;
  const observedEventPayloads: Array<{ message: string }> = [];
  const testTaskLocalId = "test-graphql-task";
  const testTaskId = `${dummyAppIds.resource(
    "test-graphql-resource"
  )}.tasks.${testTaskLocalId}`;
  const testEventLocalId = "test-graphql-event";
  const testEventId = `${dummyAppIds.resource(
    "test-graphql-resource"
  )}.events.${testEventLocalId}`;
  const missingTaskId = "non-existent-task";

  const testTask = defineTask({
    id: testTaskLocalId,
    dependencies: { logger: runnerResources.logger },
    async run(_input, { logger: _logger }) {
      return "original graphql test";
    },
  });

  const testEvent = defineEvent<{ message: string }>({
    id: testEventLocalId,
  });

  const testEventHook = defineHook({
    id: "test-graphql-event-hook",
    on: testEvent,
    async run(input) {
      observedEventPayloads.push(input.data);
    },
  });

  const testResource = defineResource({
    id: "test-graphql-resource",
    register: [testTask, testEvent, testEventHook],
  });

  // Probe resource to capture dependencies after initialization
  const probe = defineResource({
    id: "test-graphql-probe",
    dependencies: {
      store: runnerResources.store,
      logger: runnerResources.logger,
      introspector: resources.introspector,
      live: resources.live,
      swapManager: resources.swapManager,
      graphql: resources.graphql,
    },
    async init(_, { store, logger, introspector, live, swapManager, graphql }) {
      context = {
        store,
        logger,
        introspector,
        live,
        swapManager,
      };

      const schema = graphql.getSchema();
      apolloServer = new ApolloServer({ schema });
    },
  });

  beforeAll(async () => {
    const app = createDummyApp([
      testResource,
      resources.introspector,
      resources.live,
      resources.swapManager,
      resources.graphql,
      telemetry,
      probe,
    ]);
    _testApp = await run(app);
  });

  afterAll(async () => {
    // Runner doesn't require explicit cleanup
  });

  beforeEach(async () => {
    // Clean up any swapped tasks
    await context.swapManager.unswapAll();
    observedEventPayloads.length = 0;
  });

  describe("Query Operations", () => {
    test("should query swapped tasks when empty", async () => {
      const query = `
        query {
          swappedTasks {
            taskId
            swappedAt
            originalCode
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.swappedTasks).toEqual([]);
      }
    });

    test("should query swapped tasks after swapping", async () => {
      // Swap a task first
      await context.swapManager.swap(
        testTaskId,
        "() => ({message: 'swapped'})"
      );

      const query = `
        query {
          swappedTasks {
            taskId
            swappedAt
            originalCode
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const swappedTasks = response.body.singleResult.data?.swappedTasks;
        assertSwappedTaskArray(swappedTasks);
        expect(swappedTasks).toHaveLength(1);
        expect(swappedTasks[0].taskId).toBe(testTaskId);
        expect(typeof swappedTasks[0].swappedAt).toBe("number");
      }
    });
  });

  describe("Mutation Operations", () => {
    test("should swap task via mutation", async () => {
      const mutation = `
        mutation SwapTask($taskId: ID!, $runCode: String!) {
          swapTask(taskId: $taskId, runCode: $runCode) {
            success
            error
            taskId
          }
        }
      `;

      const variables = {
        taskId: testTaskId,
        runCode: `
          async function run() {
            return { message: "swapped via GraphQL", value: 123 };
          }
        `,
      };

      const response = await apolloServer.executeOperation(
        { query: mutation, variables },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const swapResult = response.body.singleResult.data
          ?.swapTask as SwapResult;
        expect(swapResult.success).toBe(true);
        expect(swapResult.taskId).toBe(testTaskId);
        expect(swapResult.error).toBeNull();
      }

      // Verify the task was actually swapped
      expect(context.swapManager.isSwapped(testTaskId)).toBe(true);
    });

    test("should handle swap mutation errors", async () => {
      const mutation = `
        mutation SwapTask($taskId: ID!, $runCode: String!) {
          swapTask(taskId: $taskId, runCode: $runCode) {
            success
            error
            taskId
          }
        }
      `;

      const variables = {
        taskId: missingTaskId,
        runCode: "() => ({})",
      };

      const response = await apolloServer.executeOperation(
        { query: mutation, variables },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const swapResult = response.body.singleResult.data?.swapTask;
        assertSwapResult(swapResult);
        expect(swapResult.success).toBe(false);
        expect(swapResult.error).toContain("not found");
        expect(swapResult.taskId).toBe(missingTaskId);
      }
    });

    test("should unswap task via mutation", async () => {
      // First swap a task
      await context.swapManager.swap(
        testTaskId,
        "() => ({message: 'swapped'})"
      );
      expect(context.swapManager.isSwapped(testTaskId)).toBe(true);

      const mutation = `
        mutation UnswapTask($taskId: ID!) {
          unswapTask(taskId: $taskId) {
            success
            error
            taskId
          }
        }
      `;

      const variables = {
        taskId: testTaskId,
      };

      const response = await apolloServer.executeOperation(
        { query: mutation, variables },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const unswapResult = response.body.singleResult.data?.unswapTask;
        assertSwapResult(unswapResult);
        expect(unswapResult.success).toBe(true);
        expect(unswapResult.taskId).toBe(testTaskId);
        expect(unswapResult.error).toBeNull();
      }

      // Verify the task was actually unswapped
      expect(context.swapManager.isSwapped(testTaskId)).toBe(false);
    });

    test("should unswap all tasks via mutation", async () => {
      // Just use one task for simpler test
      await context.swapManager.swap(
        testTaskId,
        "() => ({message: 'swapped1'})"
      );

      expect(context.swapManager.getSwappedTasks()).toHaveLength(1);

      const mutation = `
        mutation UnswapAllTasks {
          unswapAllTasks {
            success
            error
            taskId
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query: mutation },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const results = response.body.singleResult.data?.unswapAllTasks;
        assertSwapResultArray(results);
        expect(results).toHaveLength(1);
        expect(results.every((r) => r.success)).toBe(true);
      }

      // Verify all tasks were unswapped
      expect(context.swapManager.getSwappedTasks()).toHaveLength(0);
    });
  });

  describe("Task Invocation", () => {
    test("should invoke task via GraphQL using a local id", async () => {
      const mutation = `
        mutation InvokeTask($taskId: ID!) {
          invokeTask(taskId: $taskId) {
            success
            error
            taskId
            result
            executionTimeMs
            invocationId
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query: mutation, variables: { taskId: testTaskLocalId } },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertInvokeTaskData(responseData);
        expect(responseData.invokeTask.success).toBe(true);
        expect(responseData.invokeTask.taskId).toBe(testTaskId);
        expect(responseData.invokeTask.result).toContain(
          "original graphql test"
        );
      }
    });

    test("should invoke task via GraphQL mutation", async () => {
      const mutation = `
        mutation InvokeTask($taskId: ID!) {
          invokeTask(taskId: $taskId) {
            success
            error
            taskId
            result
            executionTimeMs
            invocationId
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query: mutation, variables: { taskId: testTaskId } },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertInvokeTaskData(responseData);
        expect(responseData.invokeTask.success).toBe(true);
        expect(responseData.invokeTask.taskId).toBe(testTaskId);
        expect(responseData.invokeTask.result).toContain(
          "original graphql test"
        );
        expect(typeof responseData.invokeTask.executionTimeMs).toBe("number");
        expect(responseData.invokeTask.invocationId).toBeTruthy();
      }
    });

    test("should invoke task with JSON input via GraphQL", async () => {
      // First swap the task to accept input
      await context.swapManager.swap(
        testTaskId,
        `
        async function run(input, deps) {
          return { 
            greeting: "Hello " + input.name,
            processed: true,
            timestamp: Date.now()
          };
        }
      `
      );

      const mutation = `
        mutation InvokeTaskWithInput($taskId: ID!, $inputJson: String) {
          invokeTask(taskId: $taskId, inputJson: $inputJson) {
            success
            error
            taskId
            result
            executionTimeMs
            invocationId
          }
        }
      `;

      const inputJson = JSON.stringify({ name: "GraphQL User" });
      const response = await apolloServer.executeOperation(
        {
          query: mutation,
          variables: { taskId: testTaskId, inputJson },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertInvokeTaskData(responseData);
        expect(responseData.invokeTask.success).toBe(true);
        expect(responseData.invokeTask.result).toContain("Hello GraphQL User");
        expect(responseData.invokeTask.result).toContain("processed");
      }
    });

    test("should invoke an event via GraphQL using its canonical id", async () => {
      const mutation = `
        mutation InvokeEvent($eventId: ID!, $inputJson: String) {
          invokeEvent(eventId: $eventId, inputJson: $inputJson) {
            success
            error
            executionTimeMs
            invocationId
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        {
          query: mutation,
          variables: {
            eventId: testEventId,
            inputJson: JSON.stringify({ message: "hello graphql event" }),
          },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertInvokeEventData(responseData);
        expect(responseData.invokeEvent.success).toBe(true);
        expect(responseData.invokeEvent.invocationId).toBeTruthy();
        expect(typeof responseData.invokeEvent.executionTimeMs).toBe("number");
      }

      expect(observedEventPayloads).toEqual([
        { message: "hello graphql event" },
      ]);
    });

    test("should handle task invocation errors via GraphQL", async () => {
      const mutation = `
        mutation InvokeTask($taskId: ID!) {
          invokeTask(taskId: $taskId) {
            success
            error
            taskId
            result
            invocationId
          }
        }
      `;

      const response = await apolloServer.executeOperation(
        { query: mutation, variables: { taskId: missingTaskId } },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertInvokeTaskData(responseData);
        expect(responseData.invokeTask.success).toBe(false);
        expect(responseData.invokeTask.error).toContain("not found");
        expect(responseData.invokeTask.taskId).toBe(missingTaskId);
        expect(responseData.invokeTask.invocationId).toBeTruthy();
      }
    });
  });

  describe("Eval Mutation", () => {
    test("should evaluate code via GraphQL mutation", async () => {
      const mutation = `
        mutation Eval($code: String!) {
          eval(code: $code) {
            success
            error
            result
            executionTimeMs
            invocationId
          }
        }
      `;

      // Ensure env allows eval in tests
      process.env.RUNNER_DEV_EVAL = "1";

      const response = await apolloServer.executeOperation(
        {
          query: mutation,
          variables: { code: "() => ({ hello: 'world' })" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        const resData = response.body.singleResult.data as any;
        const res = resData?.eval as any;
        expect(res.success).toBe(true);
        expect(JSON.parse(res.result).hello).toBe("world");
        expect(typeof res.executionTimeMs).toBe("number");
        expect(res.invocationId).toBeTruthy();
      }
    });

    test("should deny eval when disabled by env", async () => {
      const mutation = `
        mutation Eval($code: String!) {
          eval(code: $code) {
            success
            error
          }
        }
      `;

      const previousEnv = captureShellEnv();
      process.env.RUNNER_DEV_EVAL = "0";
      process.env.NODE_ENV = "production";

      try {
        const response = await apolloServer.executeOperation(
          {
            query: mutation,
            variables: { code: "() => 1" },
          },
          { contextValue: context }
        );

        expect(response.body.kind).toBe("single");
        if (response.body.kind === "single") {
          const resData = response.body.singleResult.data as any;
          const res = resData?.eval as any;
          expect(res.success).toBe(false);
          expect(res.error).toContain("Eval is disabled");
        }
      } finally {
        restoreShellEnv(previousEnv);
      }
    });
  });

  describe("Shell Mutation", () => {
    test("should run a snippet with runtime access", async () => {
      const mutation = `
        mutation Shell($code: String!) {
          shell(code: $code) {
            success
            error
            result
            logs
            executionTimeMs
            invocationId
          }
        }
      `;

      process.env.RUNNER_DEV_EVAL = "1";

      const response = await apolloServer.executeOperation(
        {
          query: mutation,
          variables: { code: `await runtime.runTask("${testTaskId}")` },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertShellData(responseData);
        expect(responseData.shell.success).toBe(true);
        expect(responseData.shell.result).toContain("original graphql test");
        expect(typeof responseData.shell.executionTimeMs).toBe("number");
        expect(responseData.shell.invocationId).toBeTruthy();
      }
    });

    test("should bind r to the requested resource", async () => {
      const mutation = `
        mutation Shell($code: String!, $resourceId: ID) {
          shell(code: $code, resourceId: $resourceId) {
            success
            error
            result
          }
        }
      `;

      process.env.RUNNER_DEV_EVAL = "1";

      const response = await apolloServer.executeOperation(
        {
          query: mutation,
          variables: { code: "r.url", resourceId: "res-db" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertShellData(responseData);
        expect(responseData.shell.success).toBe(true);
        expect(responseData.shell.result).toContain("memory://");
      }
    });

    test("should deny shell when disabled by env", async () => {
      const mutation = `
        mutation Shell($code: String!) {
          shell(code: $code) {
            success
            error
          }
        }
      `;

      const previousEnv = captureShellEnv();
      process.env.RUNNER_DEV_EVAL = "0";
      process.env.NODE_ENV = "production";

      try {
        const response = await apolloServer.executeOperation(
          { query: mutation, variables: { code: "1 + 1" } },
          { contextValue: context }
        );

        expect(response.body.kind).toBe("single");
        if (response.body.kind === "single") {
          const responseData = response.body.singleResult.data;
          assertShellData(responseData);
          expect(responseData.shell.success).toBe(false);
          expect(responseData.shell.error).toContain("Shell is disabled");
        }
      } finally {
        restoreShellEnv(previousEnv);
      }
    });

    test("should deny shell when NODE_ENV is unset (fail closed)", async () => {
      const mutation = `
        mutation Shell($code: String!) {
          shell(code: $code) {
            success
            error
            result
          }
        }
      `;

      const previousEnv = captureShellEnv();
      delete process.env.RUNNER_DEV_EVAL;
      delete process.env.NODE_ENV;

      try {
        const response = await apolloServer.executeOperation(
          { query: mutation, variables: { code: "1 + 1" } },
          { contextValue: context }
        );

        expect(response.body.kind).toBe("single");
        if (response.body.kind === "single") {
          const responseData = response.body.singleResult.data;
          assertShellData(responseData);
          expect(responseData.shell.success).toBe(false);
          expect(responseData.shell.result).toBeNull();
          expect(responseData.shell.error).toContain("RUNNER_DEV_EVAL=1");
          expect(responseData.shell.error).toContain("NODE_ENV=development");
        }
      } finally {
        restoreShellEnv(previousEnv);
      }
    });

    test("should expose the shell gate through shellEnabled", async () => {
      const query = `
        query ShellEnabled {
          shellEnabled
        }
      `;

      const previousEnv = captureShellEnv();
      try {
        process.env.RUNNER_DEV_EVAL = "1";
        const enabledResponse = await apolloServer.executeOperation(
          { query },
          { contextValue: context }
        );
        expect(enabledResponse.body.kind).toBe("single");
        if (enabledResponse.body.kind === "single") {
          const responseData = enabledResponse.body.singleResult.data;
          assertShellEnabledData(responseData);
          expect(responseData.shellEnabled).toBe(true);
        }

        process.env.RUNNER_DEV_EVAL = "0";
        process.env.NODE_ENV = "production";
        const disabledResponse = await apolloServer.executeOperation(
          { query },
          { contextValue: context }
        );
        expect(disabledResponse.body.kind).toBe("single");
        if (disabledResponse.body.kind === "single") {
          const responseData = disabledResponse.body.singleResult.data;
          assertShellEnabledData(responseData);
          expect(responseData.shellEnabled).toBe(false);
        }

        delete process.env.RUNNER_DEV_EVAL;
        delete process.env.NODE_ENV;
        const unsetEnvResponse = await apolloServer.executeOperation(
          { query },
          { contextValue: context }
        );
        expect(unsetEnvResponse.body.kind).toBe("single");
        if (unsetEnvResponse.body.kind === "single") {
          const responseData = unsetEnvResponse.body.singleResult.data;
          assertShellEnabledData(responseData);
          expect(responseData.shellEnabled).toBe(false);
        }
      } finally {
        restoreShellEnv(previousEnv);
      }
    });
  });

  describe("Shell Completion Query", () => {
    test("should complete runtime members", async () => {
      const query = `
        query ShellComplete($code: String!, $position: Int!) {
          shellComplete(code: $code, position: $position) {
            from
            options {
              label
              type
              detail
            }
          }
        }
      `;

      process.env.RUNNER_DEV_EVAL = "1";

      const response = await apolloServer.executeOperation(
        {
          query,
          variables: { code: "runtime.run", position: 11 },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertShellCompleteData(responseData);
        expect(responseData.shellComplete.from).toBe(8);
        const labels = responseData.shellComplete.options.map((o) => o.label);
        expect(labels).toContain("runTask");
      }
    });

    test("should complete resource members for r", async () => {
      const query = `
        query ShellComplete($code: String!, $position: Int!, $resourceId: ID) {
          shellComplete(code: $code, position: $position, resourceId: $resourceId) {
            from
            options {
              label
            }
          }
        }
      `;

      process.env.RUNNER_DEV_EVAL = "1";

      const response = await apolloServer.executeOperation(
        {
          query,
          variables: { code: "r.", position: 2, resourceId: "res-db" },
        },
        { contextValue: context }
      );

      expect(response.body.kind).toBe("single");
      if (response.body.kind === "single") {
        expect(response.body.singleResult.errors).toBeUndefined();
        const responseData = response.body.singleResult.data;
        assertShellCompleteData(responseData);
        const labels = responseData.shellComplete.options.map((o) => o.label);
        expect(labels).toContain("url");
      }
    });

    test("should yield no options when disabled by env", async () => {
      const query = `
        query ShellComplete($code: String!, $position: Int!) {
          shellComplete(code: $code, position: $position) {
            from
            options {
              label
            }
          }
        }
      `;

      const previousEnv = captureShellEnv();
      process.env.RUNNER_DEV_EVAL = "0";
      process.env.NODE_ENV = "production";

      try {
        const response = await apolloServer.executeOperation(
          { query, variables: { code: "runtime.", position: 8 } },
          { contextValue: context }
        );

        expect(response.body.kind).toBe("single");
        if (response.body.kind === "single") {
          const responseData = response.body.singleResult.data;
          assertShellCompleteData(responseData);
          expect(responseData.shellComplete.options).toEqual([]);
        }
      } finally {
        restoreShellEnv(previousEnv);
      }
    });
  });

  describe("Integration with Live Debugging", () => {
    test("should swap task with debug logging and capture in live telemetry", async () => {
      const debugCode = `
        async function run(input, deps) {
          if (deps.logger?.info) {
            deps.logger.info("DEBUG: Task execution started", { input });
          }
          
          const result = { 
            message: "debug enabled", 
            debugInfo: { 
              executedAt: new Date().toISOString(),
              inputReceived: !!input 
            } 
          };
          
          if (deps.logger?.info) {
            deps.logger.info("DEBUG: Task execution completed", { result });
          }
          return result;
        }
      `;

      // Swap with debug code
      const swapMutation = `
        mutation SwapTask($taskId: ID!, $runCode: String!) {
          swapTask(taskId: $taskId, runCode: $runCode) {
            success
            error
            taskId
          }
        }
      `;

      const swapResponse = await apolloServer.executeOperation(
        {
          query: swapMutation,
          variables: { taskId: testTaskId, runCode: debugCode },
        },
        { contextValue: context }
      );

      expect(swapResponse.body.kind).toBe("single");
      if (swapResponse.body.kind === "single") {
        const swapResult = swapResponse.body.singleResult.data
          ?.swapTask as SwapResult;
        expect(swapResult.success).toBe(true);
      }

      // Execute through swap manager path to ensure swap interception works.
      await context.swapManager.invokeTask(
        testTaskId,
        JSON.stringify({ testInput: "debug test" }),
        true
      );

      // Query recent logs to verify debug output was captured
      const logsQuery = `
        query {
          live {
            logs(last: 10) {
              timestampMs
              level
              message
              data
            }
          }
        }
      `;

      const logsResponse = await apolloServer.executeOperation(
        { query: logsQuery },
        { contextValue: context }
      );

      expect(logsResponse.body.kind).toBe("single");
      if (logsResponse.body.kind === "single") {
        const responseData = logsResponse.body.singleResult.data;
        assertLiveData(responseData);
        const logs = responseData.live.logs;
        expect(Array.isArray(logs)).toBe(true);

        // Look for our debug logs
        const debugLogs = logs.filter((log: any) =>
          log.message.includes("DEBUG: Task execution")
        );
        expect(debugLogs.length).toBeGreaterThan(0);
      }
    });

    test("should combine swap operations with task introspection", async () => {
      // Query task info first
      const taskQuery = `
        query GetTask($taskId: ID!) {
          task(id: $taskId) {
            id
            meta {
              title
              description
            }
            dependsOn
            emits
          }
        }
      `;

      const taskResponse = await apolloServer.executeOperation(
        { query: taskQuery, variables: { taskId: testTaskId } },
        { contextValue: context }
      );

      expect(taskResponse.body.kind).toBe("single");
      if (taskResponse.body.kind === "single") {
        const responseData = taskResponse.body.singleResult.data;
        assertTaskData(responseData);
        expect(responseData.task.id).toBe(testTaskId);
      }

      // Now swap the task
      const swapMutation = `
        mutation SwapTask($taskId: ID!, $runCode: String!) {
          swapTask(taskId: $taskId, runCode: $runCode) {
            success
            taskId
          }
        }
      `;

      const swapResponse = await apolloServer.executeOperation(
        {
          query: swapMutation,
          variables: {
            taskId: testTaskId,
            runCode: "() => ({ message: 'introspected and swapped' })",
          },
        },
        { contextValue: context }
      );

      expect(swapResponse.body.kind).toBe("single");
      if (swapResponse.body.kind === "single") {
        const responseData = swapResponse.body.singleResult.data;
        assertSwapTaskData(responseData);
        expect(responseData.swapTask.success).toBe(true);
      }

      // Verify task info is still accessible after swap
      const taskAfterSwapResponse = await apolloServer.executeOperation(
        { query: taskQuery, variables: { taskId: testTaskId } },
        { contextValue: context }
      );

      expect(taskAfterSwapResponse.body.kind).toBe("single");
      if (taskAfterSwapResponse.body.kind === "single") {
        const responseData = taskAfterSwapResponse.body.singleResult.data;
        assertTaskData(responseData);
        expect(responseData.task.id).toBe(testTaskId);
        // Metadata should remain unchanged
      }
    });
  });
});
