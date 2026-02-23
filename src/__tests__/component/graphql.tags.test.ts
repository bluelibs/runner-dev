import { createDummyApp, areaTag, helloTask } from "../dummy/dummyApp";
import { r, resource, run, globals } from "@bluelibs/runner";
import { graphql as executeGraphql } from "graphql";
import { schema } from "../../schema";
import { introspector } from "../../resources/introspector.resource";

describe("GraphQL Tags", () => {
  it("exposes tags() and tag(id) reverse usage with configs", async () => {
    let context: any;
    const probe = resource({
      id: "probe.graphql-tags",
      dependencies: { introspector, store: globals.resources.store },
      async init(_c, { introspector, store }) {
        context = { introspector, store, live: { logs: [] }, logger: console };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    // tags() contains the known tag
    const q1 = `{ tags { id } }`;
    const r1 = await executeGraphql({
      schema,
      source: q1,
      contextValue: context,
    });
    expect(r1.errors).toBeUndefined();
    const tagsData: any = r1.data;
    expect(tagsData?.tags.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([areaTag.id])
    );

    const q2 = `query($id: ID!){
      tag(id:$id){
        id
        tasks{ id meta{ tags{ id config } } }
        hooks{ id meta{ tags{ id config } } }
        resources{ id }
        taskMiddlewares{ id }
        resourceMiddlewares{ id }
        events{ id }
        errors{ id }
        targets
        all{ __typename id }
      }
    }`;
    const r2 = await executeGraphql({
      schema,
      source: q2,
      variableValues: { id: areaTag.id },
      contextValue: context,
    });
    expect(r2.errors).toBeUndefined();
    const usage = r2.data?.tag as any;
    expect(usage.id).toBe(areaTag.id);
    // Our dummy app adds the tag to helloTask and helloHook
    expect(usage.tasks.map((t: any) => t.id)).toEqual(
      expect.arrayContaining([helloTask.id])
    );
    expect(usage.hooks.length).toBeGreaterThan(0);
    // configs present
    const taggedTask = usage.tasks.find((t: any) => t.id === helloTask.id);
    expect(taggedTask.meta.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: areaTag.id,
          config: expect.stringMatching(/greetings/),
        }),
      ])
    );
  });

  it("exposes tag targets and tag dependencies in dependsOn", async () => {
    const taskOnlyTag = r
      .tag("app.tags.taskOnlyForGraphql")
      .for(["tasks"])
      .build();
    const dependencyTag = r.tag("app.tags.dependencyForGraphql").build();

    const taskUsingTagDependency = r
      .task("app.tasks.usesTagDependency")
      .dependencies({ dependencyTag })
      .tags([taskOnlyTag])
      .run(async () => "ok")
      .build();

    let context: any;
    const probe = resource({
      id: "probe.graphql-tags.targets",
      dependencies: { introspector, store: globals.resources.store },
      async init(_c, { introspector, store }) {
        context = { introspector, store, live: { logs: [] }, logger: console };
      },
    });

    const app = createDummyApp([
      introspector,
      taskOnlyTag,
      dependencyTag,
      taskUsingTagDependency,
      probe,
    ]);
    await run(app);

    const query = `query($taskId: ID!, $tagId: ID!){
      task(id:$taskId){ id dependsOn }
      tag(id:$tagId){
        id
        targets
        tasks { id }
      }
    }`;

    const result = await executeGraphql({
      schema,
      source: query,
      variableValues: {
        taskId: taskUsingTagDependency.id,
        tagId: taskOnlyTag.id,
      },
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();
    const data = result.data as any;
    expect(data.task.dependsOn).toEqual(
      expect.arrayContaining([dependencyTag.id])
    );
    expect(data.tag.targets).toEqual(["TASKS"]);
    expect(data.tag.tasks.map((task: any) => task.id)).toEqual(
      expect.arrayContaining([taskUsingTagDependency.id])
    );

    const handlers = context.introspector.getTagHandlers(dependencyTag.id);
    expect(handlers.tasks.map((task: any) => task.id)).toEqual(
      expect.arrayContaining([taskUsingTagDependency.id])
    );
  });
});
