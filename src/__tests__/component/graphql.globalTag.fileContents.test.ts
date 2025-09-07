import { resource, run, globals, IResource } from "@bluelibs/runner";
import { graphql } from "graphql";
import { schema } from "../../schema";
import { introspector } from "../../resources/introspector.resource";

describe("GraphQL Tag fileContents for node_modules tag", () => {
  test("fetches fileContents for globals.tags.excludeFromGlobalHooks", async () => {
    let ctx: any;

    const taggedRes = resource({
      id: "probe.taggedWithGlobal",
      // Refer to the global tag so it is present in the store
      tags: [globals.tags.excludeFromGlobalHooks],
      async init() {
        return {};
      },
    });

    const probe = resource({
      id: "probe.globalTagFileContents",
      dependencies: { introspector },
      async init(_c, { introspector }) {
        ctx = {
          introspector,
          store: undefined,
          live: { logs: [] },
          logger: console,
        };
      },
    });

    await run(
      resource({
        id: "root.app",
        register: [introspector, taggedRes, probe],
        dependencies: {},
      }) as unknown as IResource<void, any>
    );

    const q = `
      query($id: ID!){
        tag(id:$id){
          id
          filePath
          fileContents
        }
      }
    `;
    const variables = { id: "globals.tags.excludeFromGlobalHooks" };
    const result = await graphql({
      schema,
      source: q,
      variableValues: variables,
      contextValue: ctx,
    });
    expect(result.errors).toBeUndefined();

    const tag: any = (result.data as any)?.tag;
    expect(tag?.id).toBe("globals.tags.excludeFromGlobalHooks");
    expect(typeof tag?.filePath).toBe("string");
    expect(tag?.filePath).toContain("node_modules:");
    // Should resolve to the dist globals/globalTags.js file
    expect(tag?.fileContents && typeof tag.fileContents === "string").toBe(
      true
    );
    expect(tag.fileContents).toContain("Exclude Event From Global Hooks");
  });
});
