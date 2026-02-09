import { globals, resource, run, tag, task } from "@bluelibs/runner";
import { memoryDurableResource } from "@bluelibs/runner/node";
import { graphql } from "graphql";
import { resources } from "../../index";
import { schema } from "../../schema";

function createDurableFixtureApp() {
  const durable = memoryDurableResource.fork("tests.durable.runtime");
  const durableRegistration = durable.with({});
  const durableWorkflowTag = tag({ id: "durable.workflow" });

  const durableTask = task({
    id: "tests.tasks.durable",
    dependencies: { durable },
    tags: [durableWorkflowTag],
    async run(_input, { durable }) {
      const ctx = durable.use();
      await ctx.step("validate", async () => true);
      await ctx.sleep(500, { stepId: "cooldown" });
      await ctx.note("done");
      return "ok";
    },
  });

  const untaggedDurableTask = task({
    id: "tests.tasks.durable.untagged",
    dependencies: { durable },
    async run(_input, { durable }) {
      const ctx = durable.use();
      await ctx.step("untagged-step", async () => true);
      return "ok";
    },
  });

  const normalTask = task({
    id: "tests.tasks.normal",
    async run() {
      return "ok";
    },
  });

  const app = resource({
    id: "tests.durable.app",
    register: [
      durableRegistration,
      durableWorkflowTag,
      durableTask,
      untaggedDurableTask,
      normalTask,
      resources.introspector,
      resources.live,
      resources.swapManager,
    ],
  });

  return { app, durableTask, untaggedDurableTask, normalTask };
}

describe("durable.describe integration", () => {
  test("GraphQL task flowShape is resolved via durable.describe()", async () => {
    const { app, durableTask, untaggedDurableTask, normalTask } =
      createDurableFixtureApp();
    const runtime = await run(app);

    const contextValue = {
      store: await runtime.getResourceValue(globals.resources.store),
      logger: console,
      introspector: await runtime.getResourceValue(resources.introspector),
      live: await runtime.getResourceValue(resources.live),
      swapManager: await runtime.getResourceValue(resources.swapManager),
    };

    const result = await graphql({
      schema,
      source: `
        query DurableShape($durableId: ID!, $untaggedId: ID!, $normalId: ID!) {
          durableTask: task(id: $durableId) {
            id
            isDurable
            durableResource { id }
            flowShape {
              nodes {
                __typename
                ... on FlowStepNode { kind stepIdStep: stepId hasCompensation }
                ... on FlowSleepNode { kind durationMs stepIdSleep: stepId }
                ... on FlowNoteNode { kind message }
              }
            }
          }
          untaggedTask: task(id: $untaggedId) {
            id
            isDurable
            durableResource { id }
            flowShape { nodes { __typename } }
          }
          normalTask: task(id: $normalId) {
            id
            isDurable
            durableResource { id }
            flowShape { nodes { __typename } }
          }
        }
      `,
      variableValues: {
        durableId: durableTask.id,
        untaggedId: untaggedDurableTask.id,
        normalId: normalTask.id,
      },
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as any;

    expect(data.durableTask.isDurable).toBe(true);
    expect(data.durableTask.durableResource.id).toBe("tests.durable.runtime");
    expect(data.durableTask.flowShape.nodes).toEqual(
      expect.arrayContaining([
        {
          __typename: "FlowStepNode",
          kind: "step",
          stepIdStep: "validate",
          hasCompensation: false,
        },
        {
          __typename: "FlowSleepNode",
          kind: "sleep",
          durationMs: 500,
          stepIdSleep: "cooldown",
        },
        {
          __typename: "FlowNoteNode",
          kind: "note",
          message: "done",
        },
      ])
    );

    expect(data.untaggedTask.isDurable).toBe(false);
    expect(data.untaggedTask.durableResource).toBeNull();
    expect(data.untaggedTask.flowShape).toBeNull();

    expect(data.normalTask.isDurable).toBe(false);
    expect(data.normalTask.durableResource).toBeNull();
    expect(data.normalTask.flowShape).toBeNull();

    await runtime.dispose();
  });

  test("live.describeFlow uses durable.describe()", async () => {
    const { app, durableTask, normalTask } = createDurableFixtureApp();
    const runtime = await run(app);

    const live = await runtime.getResourceValue(resources.live);

    const durableShape = await live.describeFlow(durableTask.id);
    const normalShape = await live.describeFlow(normalTask.id);

    expect(durableShape?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "step", stepId: "validate" }),
        expect.objectContaining({
          kind: "sleep",
          durationMs: 500,
        }),
        expect.objectContaining({ kind: "note", message: "done" }),
      ])
    );
    expect(normalShape).toBeNull();

    await runtime.dispose();
  });
});
