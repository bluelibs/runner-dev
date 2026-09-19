import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BaseElementInterface, AllType } from "../../schema/types/AllType";
import { TaskType } from "../../schema/types/TaskType";
import { HookType } from "../../schema/types/HookType";
import {
  TaskMiddlewareType,
  ResourceMiddlewareType,
  MiddlewareType,
} from "../../schema/types/MiddlewareType";
import { stampElementKind } from "../../resources/models/introspector.tools";
import { callSnapshotGraphQL } from "../../mcp/snapshot";

function resolveTypeName(value: unknown): unknown {
  return BaseElementInterface.resolveType?.(value, {}, {} as any, {} as any);
}

describe("GraphQL type discrimination", () => {
  test("Task isTypeOf trusts the stamp and excludes hooks/resources", () => {
    expect(
      TaskType.isTypeOf?.(
        stampElementKind({} as any, "TASK"),
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      TaskType.isTypeOf?.(
        stampElementKind({} as any, "HOOK"),
        {} as any,
        {} as any
      )
    ).toBe(false);
    // Unstamped (deserialized) shapes
    expect(
      TaskType.isTypeOf?.(
        { emits: [], dependsOn: [] } as any,
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      TaskType.isTypeOf?.(
        { emits: [], dependsOn: [], events: [] } as any,
        {} as any,
        {} as any
      )
    ).toBe(false);
    expect(
      TaskType.isTypeOf?.(
        { emits: [], dependsOn: [], registers: [], overrides: [] } as any,
        {} as any,
        {} as any
      )
    ).toBe(false);
  });

  test("Hook isTypeOf trusts the stamp and excludes tags", () => {
    expect(
      HookType.isTypeOf?.(
        stampElementKind({} as any, "HOOK"),
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      HookType.isTypeOf?.(
        stampElementKind({} as any, "TAG"),
        {} as any,
        {} as any
      )
    ).toBe(false);
    expect(
      HookType.isTypeOf?.({ events: [] } as any, {} as any, {} as any)
    ).toBe(true);
    expect(
      HookType.isTypeOf?.(
        { events: [], tasks: [], hooks: [] } as any,
        {} as any,
        {} as any
      )
    ).toBe(false);
  });

  test("middleware isTypeOf checks the type discriminator", () => {
    expect(
      TaskMiddlewareType.isTypeOf?.(
        { type: "task", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      TaskMiddlewareType.isTypeOf?.(
        { type: "resource", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(false);
    expect(
      ResourceMiddlewareType.isTypeOf?.(
        { type: "resource", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      ResourceMiddlewareType.isTypeOf?.(
        { type: "task", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(false);
    // Empty usage arrays must not match: the legacy combined type only
    // accepts values carrying a middleware discriminator.
    expect(
      MiddlewareType.isTypeOf?.(
        { type: "task", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      MiddlewareType.isTypeOf?.(
        { type: "resource", usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(true);
    expect(
      MiddlewareType.isTypeOf?.(
        { usedByTasks: [], usedByResources: [] },
        {} as any,
        {} as any
      )
    ).toBe(false);
  });

  test("interface resolveType detects tags before hooks", () => {
    expect(resolveTypeName(stampElementKind({} as any, "TAG"))).toBe("Tag");
    expect(
      resolveTypeName({ tasks: [], hooks: [], events: [], targets: null })
    ).toBe("Tag");
    expect(resolveTypeName({ events: [] })).toBe("Hook");
    expect(resolveTypeName({ emits: [], dependsOn: [] })).toBe("Task");
    expect(resolveTypeName({ id: "lonely" })).toBe("All");
  });

  test("snapshot type inference detects tags before hooks", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-tag-"));
    const snapshotFile = path.join(dir, "snapshot.json");
    await fs.writeFile(
      snapshotFile,
      JSON.stringify({
        introspectorData: {
          tasks: [],
          hooks: [],
          resources: [],
          events: [],
          middlewares: [],
          tags: [
            {
              id: "tag-area",
              meta: null,
              filePath: null,
              configSchema: null,
              targets: null,
              isPrivate: false,
              visibilityReason: "Tags are globally discoverable metadata.",
              tasks: [],
              hooks: [],
              resources: [],
              taskMiddlewares: [],
              resourceMiddlewares: [],
              events: [],
              errors: [],
            },
          ],
          errors: [],
          asyncContexts: [],
        },
        graphqlSdl: "type Query { all: [String] }",
      }),
      "utf8"
    );

    const result = await callSnapshotGraphQL({
      snapshotFile,
      query: `{ all { __typename id } }`,
    });

    expect(result.errors).toBeUndefined();
    expect((result.data as any)?.all).toEqual([
      { __typename: "Tag", id: "tag-area" },
    ]);
  });

  test("All isTypeOf rejects tag-shaped values", () => {
    expect(
      AllType.isTypeOf?.(
        stampElementKind({} as any, "TAG"),
        {} as any,
        {} as any
      )
    ).toBe(false);
    expect(
      AllType.isTypeOf?.(
        { id: "t", tasks: [], hooks: [], events: [] },
        {} as any,
        {} as any
      )
    ).toBe(false);
    expect(AllType.isTypeOf?.({ id: "lonely" }, {} as any, {} as any)).toBe(
      true
    );
  });
});
