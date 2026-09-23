import {
  run,
  defineTask,
  defineEvent,
  defineHook,
  defineResource,
  resources as runnerResources,
} from "@bluelibs/runner";
import { graphql as executeGraphql, type GraphQLSchema } from "graphql";
import { resources } from "../../index";
import type { CustomGraphQLContext } from "../../schema/context";
import { createDummyApp } from "../dummy/dummyApp";
import { CODE_EXECUTION_DISABLED_ENV, withEnvAsync } from "./withEnv";

type OperationResult = {
  success: boolean;
  error?: string | null;
  result?: string | null;
};

function assertOperationResult(
  field: string,
  payload: unknown
): asserts payload is OperationResult {
  if (!payload || typeof payload !== "object" || !("success" in payload)) {
    throw new Error(`Expected an operation result for ${field}`);
  }
}

const ENABLE_HINT = /RUNNER_DEV_EVAL=1 or NODE_ENV=development/;

describe("GraphQL code-execution gate", () => {
  let schema: GraphQLSchema;
  let context: CustomGraphQLContext;
  const receivedEvents: unknown[] = [];

  const gatedTask = defineTask({
    id: "gate-probe-task",
    async run(input: unknown) {
      return { echoed: input };
    },
  });
  const gatedEvent = defineEvent<unknown>({ id: "gate-probe-event" });
  const gatedEventHook = defineHook({
    id: "gate-probe-event-hook",
    on: gatedEvent,
    async run(emission) {
      receivedEvents.push(emission.data);
    },
  });

  const probe = defineResource({
    id: "gate-probe",
    dependencies: {
      store: runnerResources.store,
      logger: runnerResources.logger,
      introspector: resources.introspector,
      live: resources.live,
      swapManager: resources.swapManager,
      graphql: resources.graphql,
    },
    async init(_config, { graphql, ...contextDeps }) {
      schema = graphql.getSchema();
      context = contextDeps;
    },
  });

  beforeAll(async () => {
    await run(
      createDummyApp([
        gatedTask,
        gatedEvent,
        gatedEventHook,
        resources.introspector,
        resources.live,
        resources.swapManager,
        resources.graphql,
        probe,
      ])
    );
  });

  beforeEach(async () => {
    receivedEvents.length = 0;
    await context.swapManager.unswapAll();
  });

  async function mutate(
    field: string,
    source: string,
    variableValues: Record<string, unknown>
  ): Promise<OperationResult> {
    const response = await executeGraphql({
      schema,
      source,
      variableValues,
      contextValue: context,
    });
    expect(response.errors).toBeUndefined();
    const payload: unknown = response.data?.[field];
    assertOperationResult(field, payload);
    return payload;
  }

  const SWAP = `mutation ($taskId: ID!, $runCode: String!) {
    swapTask(taskId: $taskId, runCode: $runCode) { success error }
  }`;
  const UNSWAP = `mutation ($taskId: ID!) {
    unswapTask(taskId: $taskId) { success error }
  }`;
  const INVOKE_TASK = `mutation ($taskId: ID!, $inputJson: String, $evalInput: Boolean) {
    invokeTask(taskId: $taskId, inputJson: $inputJson, evalInput: $evalInput) { success error result }
  }`;
  const INVOKE_EVENT = `mutation ($eventId: ID!, $inputJson: String, $evalInput: Boolean) {
    invokeEvent(eventId: $eventId, inputJson: $inputJson, evalInput: $evalInput) { success error }
  }`;
  const SHELL = `mutation ($code: String!) { shell(code: $code) { success error } }`;
  const EVAL = `mutation ($code: String!) { eval(code: $code) { success error } }`;

  describe("when code execution is disabled (NODE_ENV unset)", () => {
    const disabled = <T>(run: () => Promise<T>) =>
      withEnvAsync(CODE_EXECUTION_DISABLED_ENV, run);

    test("refuses swapTask without compiling or swapping", () =>
      disabled(async () => {
        const result = await mutate("swapTask", SWAP, {
          taskId: gatedTask.id,
          runCode: "async () => 'hijacked'",
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Task swapping is disabled");
        expect(result.error).toMatch(ENABLE_HINT);
        expect(context.swapManager.isSwapped(gatedTask.id)).toBe(false);
      }));

    test("refuses invokeTask with evalInput before evaluating it", () =>
      disabled(async () => {
        const result = await mutate("invokeTask", INVOKE_TASK, {
          taskId: gatedTask.id,
          inputJson: "(() => { throw new Error('evaluated'); })()",
          evalInput: true,
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("evalInput");
        expect(result.error).toMatch(ENABLE_HINT);
        expect(result.error).not.toContain("evaluated");
      }));

    test("still allows invokeTask with plain JSON input", () =>
      disabled(async () => {
        const result = await mutate("invokeTask", INVOKE_TASK, {
          taskId: gatedTask.id,
          inputJson: JSON.stringify({ n: 1 }),
        });
        expect(result.success).toBe(true);
        expect(result.result).toContain('"n": 1');
      }));

    test("refuses invokeEvent with evalInput without emitting", () =>
      disabled(async () => {
        const result = await mutate("invokeEvent", INVOKE_EVENT, {
          eventId: gatedEvent.id,
          inputJson: "({ viaEval: true })",
          evalInput: true,
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(ENABLE_HINT);
        expect(receivedEvents).toEqual([]);
      }));

    test("still allows invokeEvent with plain JSON input", () =>
      disabled(async () => {
        const result = await mutate("invokeEvent", INVOKE_EVENT, {
          eventId: gatedEvent.id,
          inputJson: JSON.stringify({ viaJson: true }),
        });
        expect(result.success).toBe(true);
        expect(receivedEvents).toEqual([{ viaJson: true }]);
      }));

    test("refuses shell and eval with the enable hint", () =>
      disabled(async () => {
        const shell = await mutate("shell", SHELL, { code: "1 + 1" });
        expect(shell.error).toContain("Shell is disabled");
        expect(shell.error).toMatch(ENABLE_HINT);
        const evalResult = await mutate("eval", EVAL, { code: "() => 1" });
        expect(evalResult.error).toContain("Eval is disabled");
        expect(evalResult.error).toMatch(ENABLE_HINT);
      }));

    test("still allows restoring a task swapped earlier", async () => {
      await context.swapManager.swap(gatedTask.id, "async () => 'swapped'");
      await disabled(async () => {
        const result = await mutate("unswapTask", UNSWAP, {
          taskId: gatedTask.id,
        });
        expect(result.success).toBe(true);
      });
      expect(context.swapManager.isSwapped(gatedTask.id)).toBe(false);
    });
  });

  describe("when code execution is enabled", () => {
    const enabled = <T>(run: () => Promise<T>) =>
      withEnvAsync({ RUNNER_DEV_EVAL: "1", NODE_ENV: "production" }, run);

    test("swapTask works with RUNNER_DEV_EVAL=1", () =>
      enabled(async () => {
        const result = await mutate("swapTask", SWAP, {
          taskId: gatedTask.id,
          runCode: "async () => 'swapped'",
        });
        expect(result.success).toBe(true);
      }));

    test("evalInput is evaluated for tasks and events", () =>
      enabled(async () => {
        const task = await mutate("invokeTask", INVOKE_TASK, {
          taskId: gatedTask.id,
          inputJson: "({ sum: 1 + 2 })",
          evalInput: true,
        });
        expect(task.success).toBe(true);
        expect(task.result).toContain('"sum": 3');

        const event = await mutate("invokeEvent", INVOKE_EVENT, {
          eventId: gatedEvent.id,
          inputJson: "({ viaEval: 40 + 2 })",
          evalInput: true,
        });
        expect(event.success).toBe(true);
        expect(receivedEvents).toEqual([{ viaEval: 42 }]);
      }));
  });
});
