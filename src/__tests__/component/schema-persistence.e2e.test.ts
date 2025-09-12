import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { schemaPersistence } from "../../resources/schema-persistence.resource";
import { Introspector, SerializedIntrospector } from "../../resources/models/Introspector";

describe("Schema Persistence E2E", () => {
  let testFilePath: string;
  let persistence: any;

  beforeEach(async () => {
    // Create unique test file for each test
    testFilePath = `/tmp/test-schema-persistence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
    
    // Clean up any existing test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    persistence = await (schemaPersistence.init as any)(
      {
        database: {
          driver: "sqlite" as const,
          options: {
            filePath: testFilePath.replace('.json', '.db'),
          },
        },
      },
      {},
      {}
    );
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    const schemaFile = testFilePath.replace('.db', '_schemas.json');
    if (fs.existsSync(schemaFile)) {
      fs.unlinkSync(schemaFile);
    }
  });

  it("should save and load schema snapshots", async () => {
    const mockIntrospectorData: SerializedIntrospector = {
      tasks: [
        {
          id: "test.task",
          input: null,
          output: null,
          definition: { id: "test.task" },
          kind: "TASK",
          tags: [],
        },
      ],
      hooks: [],
      resources: [],
      events: [],
      middlewares: [],
      tags: [],
    };

    const mockGraphQLSchema = `
      type Query {
        hello: String
      }
    `;

    // Save schema
    await persistence.saveSchema(mockIntrospectorData, mockGraphQLSchema);

    // Load latest schema
    const latestSchema = await persistence.loadLatestSchema();

    expect(latestSchema).not.toBeNull();
    expect(latestSchema!.introspectorData.tasks).toHaveLength(1);
    expect(latestSchema!.introspectorData.tasks[0].id).toBe("test.task");
    expect(latestSchema!.graphqlSchema).toContain("type Query");
    expect(latestSchema!.isActive).toBe(true);
  });

  it("should maintain multiple schema snapshots", async () => {
    const mockIntrospectorData1: SerializedIntrospector = {
      tasks: [{ id: "task1", input: null, output: null, definition: { id: "task1" }, kind: "TASK", tags: [] }],
      hooks: [],
      resources: [],
      events: [],
      middlewares: [],
      tags: [],
    };

    const mockIntrospectorData2: SerializedIntrospector = {
      tasks: [
        { id: "task1", input: null, output: null, definition: { id: "task1" }, kind: "TASK", tags: [] },
        { id: "task2", input: null, output: null, definition: { id: "task2" }, kind: "TASK", tags: [] },
      ],
      hooks: [],
      resources: [],
      events: [],
      middlewares: [],
      tags: [],
    };

    // Save first schema
    await persistence.saveSchema(mockIntrospectorData1, "schema v1");
    
    // Save second schema
    await persistence.saveSchema(mockIntrospectorData2, "schema v2");

    // Get all schemas
    const allSchemas = await persistence.getAllSchemas();
    expect(allSchemas).toHaveLength(2);

    // Latest should be the second one
    const latestSchema = await persistence.loadLatestSchema();
    expect(latestSchema!.introspectorData.tasks).toHaveLength(2);
    expect(latestSchema!.graphqlSchema).toBe("schema v2");
    expect(latestSchema!.isActive).toBe(true);

    // First schema should be inactive
    expect(allSchemas[0].isActive).toBe(false);
  });

  it("should handle deserialization of saved schemas", async () => {
    const mockIntrospectorData: SerializedIntrospector = {
      tasks: [
        {
          id: "test.task.complex",
          input: { schema: '{"type": "object"}' },
          output: { schema: '{"type": "string"}' },
          definition: { id: "test.task.complex" },
          kind: "TASK",
          tags: ["test-tag"],
        },
      ],
      hooks: [],
      resources: [
        {
          id: "test.resource",
          definition: { id: "test.resource" },
          kind: "RESOURCE",
          dependencies: [],
          tags: [],
        },
      ],
      events: [],
      middlewares: [],
      tags: [
        {
          id: "test-tag",
          definition: { id: "test-tag" },
          kind: "TAG",
        },
      ],
    };

    // Save schema
    await persistence.saveSchema(mockIntrospectorData, "complex schema");

    // Load and deserialize
    const latestSchema = await persistence.loadLatestSchema();
    expect(latestSchema).not.toBeNull();

    const deserializedIntrospector = Introspector.deserialize(latestSchema!.introspectorData);
    
    expect(deserializedIntrospector.tasks).toHaveLength(1);
    expect(deserializedIntrospector.resources).toHaveLength(1);
    expect(deserializedIntrospector.tags).toHaveLength(1);
    expect(deserializedIntrospector.tasks[0].id).toBe("test.task.complex");
    expect(deserializedIntrospector.resources[0].id).toBe("test.resource");
    expect(deserializedIntrospector.tags[0].id).toBe("test-tag");
  });

  it("should return null when no schema exists", async () => {
    const latestSchema = await persistence.loadLatestSchema();
    expect(latestSchema).toBeNull();

    const allSchemas = await persistence.getAllSchemas();
    expect(allSchemas).toHaveLength(0);
  });
});