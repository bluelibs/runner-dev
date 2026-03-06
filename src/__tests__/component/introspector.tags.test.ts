import {
  createDummyApp,
  areaTag,
  dummyAppIds,
  helloTask,
} from "../dummy/dummyApp";
import { defineResource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";

describe("Introspector Tags", () => {
  it("collects all tags and provides reverse lookups", async () => {
    let i: any;
    const probe = defineResource({
      id: "probe-introspector-tags",
      dependencies: { introspector },
      async init(_c, { introspector }) {
        i = introspector;
      },
    });
    const app = createDummyApp([introspector, probe]);
    await run(app);

    const allTags = i.getAllTags();
    expect(allTags.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([dummyAppIds.tag(areaTag.id)])
    );

    const tTasks = i
      .getTasksWithTag(dummyAppIds.tag(areaTag.id))
      .map((t: any) => t.id);
    expect(tTasks).toEqual(
      expect.arrayContaining([dummyAppIds.task(helloTask.id)])
    );

    const tHooks = i.getHooksWithTag(dummyAppIds.tag(areaTag.id));
    expect(tHooks.length).toBeGreaterThan(0);
  });
});
