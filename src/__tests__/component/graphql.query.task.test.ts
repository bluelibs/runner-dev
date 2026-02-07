import { run } from "@bluelibs/runner";
import { createDummyApp } from "../dummy/dummyApp";
import { resources } from "../../index";
import { graphqlQueryTask } from "../../resources/graphql.query.task";

describe("graphqlQueryTask", () => {
  test("executes a simple query", async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.graphql,
      resources.swapManager,
      resources.live,
      graphqlQueryTask,
    ]);
    const rr = await run(app);

    const result = await rr.runTask(graphqlQueryTask, {
      query: `query { tasks { id } }`,
    });

    expect(result).toBeDefined();
    if (!result) throw new Error("No result returned");
    expect(result.ok).toBe(true);
    expect(Array.isArray((result as unknown as { data: any }).data.tasks)).toBe(
      true
    );

    await rr.dispose();
  });

  test("supports variables and operationName", async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.graphql,
      resources.swapManager,
      resources.live,
      graphqlQueryTask,
    ]);
    const rr = await run(app);

    const query = `
      query One($sub: ID) {
        tasks(idIncludes: $sub) { id }
      }
    `;

    const result = await rr.runTask(graphqlQueryTask, {
      query,
      variables: { sub: "hello" },
      operationName: "One",
    });

    expect(result).toBeDefined();
    if (!result) throw new Error("No result returned");
    expect(result.ok).toBe(true);
    const ids = (
      result as unknown as { data: { tasks: Array<{ id: string }> } }
    ).data.tasks.map((t) => t.id);
    expect(ids.some((id: string) => id.includes("hello"))).toBe(true);

    await rr.dispose();
  });
});
