import { createDummyApp, areaTag, helloTask } from "../dummy/dummyApp";
import { resource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";

describe("Introspector Tags", () => {
  it("collects all tags and provides reverse lookups", async () => {
    let i: any;
    const probe = resource({
      id: "probe.introspector-tags",
      dependencies: { introspector },
      async init(_c, { introspector }) {
        i = introspector;
      },
    });
    const app = createDummyApp([introspector, probe]);
    await run(app);

    const allTags = i.getAllTags();
    expect(allTags.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([areaTag.id])
    );

    const tTasks = i.getTasksWithTag(areaTag.id).map((t: any) => t.id);
    expect(tTasks).toEqual(expect.arrayContaining([helloTask.id]));

    const tHooks = i.getHooksWithTag(areaTag.id);
    expect(tHooks.length).toBeGreaterThan(0);
  });
});
