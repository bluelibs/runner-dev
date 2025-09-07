import { z } from "zod";
import { formatSchemaIfZod, isZodSchema } from "../../utils/zod";
import {
  mapStoreTaskToTaskModel,
  mapStoreResourceToResourceModel,
  buildEvents,
} from "../../resources/models/initializeFromStore.utils";
import { definitions } from "@bluelibs/runner";

describe("Zod schema conversion", () => {
  test("formatSchemaIfZod returns JSON schema string", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int().optional(),
    });
    expect(isZodSchema(schema)).toBe(true);
    const jsonStr = formatSchemaIfZod(schema);
    expect(typeof jsonStr).toBe("string");
    const json = JSON.parse(String(jsonStr));
    // zod-to-json-schema default output references a named definition
    expect(json.$schema).toMatch(/json-schema/i);
    expect(typeof json.$ref).toBe("string");
    const defName = json.$ref.replace("#/definitions/", "");
    const root = json.definitions[defName];
    expect(root.type).toBe("object");
    expect(root.properties.name.type).toBe("string");
    // age can be number or undefined -> either no required or optional
    expect(Object.keys(root.properties)).toEqual(
      expect.arrayContaining(["name", "age"])
    );
  });
});

describe("Introspector mapping picks up Zod schemas", () => {
  test("task inputSchema is formatted when Zod provided", () => {
    const fakeTask = {
      id: "task.zod",
      meta: null,
      dependencies: {},
      middleware: [],
      inputSchema: z.object({ q: z.string() }),
    } as unknown as definitions.ITask;

    const result = mapStoreTaskToTaskModel(fakeTask);
    expect(typeof result.inputSchema).toBe("string");
    const json = JSON.parse(String(result.inputSchema));
    const defName = json.$ref.replace("#/definitions/", "");
    const root = json.definitions[defName];
    expect(root.type).toBe("object");
    expect(root.properties.q.type).toBe("string");
  });

  test("resource configSchema is formatted when Zod provided", () => {
    const fakeRes = {
      id: "res.zod",
      meta: null,
      dependencies: {},
      middleware: [],
      overrides: [],
      register: [],
      context: null,
      configSchema: z.object({ ttlMs: z.number() }),
    } as unknown as definitions.IResource;

    const result = mapStoreResourceToResourceModel(fakeRes);
    expect(typeof result.configSchema).toBe("string");
    const json = JSON.parse(String(result.configSchema));
    const defName = json.$ref.replace("#/definitions/", "");
    const root = json.definitions[defName];
    expect(root.type).toBe("object");
    expect(root.properties.ttlMs.type).toBe("number");
  });
});
