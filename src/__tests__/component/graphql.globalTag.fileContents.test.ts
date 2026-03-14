import { defineEvent, defineResource, run, tags } from "@bluelibs/runner";
import { graphql } from "graphql";
import { schema } from "../../schema";
import { introspector } from "../../resources/introspector.resource";
import type { Introspector } from "../../resources/models/Introspector";

type MinimalTestContext = {
  introspector: Introspector;
  store: undefined;
  live: { logs: never[] };
  logger: Console;
};

describe("GraphQL Tag fileContents for node_modules tag", () => {
  test("fetches fileContents for tags.excludeFromGlobalHooks", async () => {
    let ctx: MinimalTestContext;

    const taggedEvt = defineEvent({
      id: "probe-taggedWithGlobal",
      tags: [tags.excludeFromGlobalHooks],
    });

    const probe = defineResource({
      id: "probe-globalTagFileContents",
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

    const app = defineResource<void>({
      id: "root-app",
      register: [introspector, taggedEvt, probe],
      dependencies: {},
    });

    await run(app);

    const q = `
      query($id: ID!){
        tag(id:$id){
          id
          filePath
          fileContents
        }
      }
    `;
    const tagId = tags.excludeFromGlobalHooks.id;
    const variables = { id: tagId };
    const result = await graphql({
      schema,
      source: q,
      variableValues: variables,
      contextValue: ctx,
    });
    expect(result.errors).toBeUndefined();

    const tag = (result.data as { tag?: Record<string, unknown> } | undefined)
      ?.tag;
    expect(String(tag?.id)).toMatch(/(^|\.)excludeFromGlobalHooks$/);
    expect(typeof tag?.filePath).toBe("string");
    const isNodeModules = tag?.filePath.includes("node_modules:");
    const isLocalLink = tag?.filePath.includes("runner");
    expect(isNodeModules || isLocalLink).toBe(true);
    // Should resolve to the dist globals/globalTags.js file
    expect(tag?.fileContents && typeof tag.fileContents === "string").toBe(
      true
    );
    expect(tag.fileContents).toContain("Exclude Event From Global Hooks");
  });
});
