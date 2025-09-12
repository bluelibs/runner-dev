import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createIntrospectorFromPersistence } from "../../resources/introspector-with-persistence.resource";
import { schemaPersistence } from "../../resources/schema-persistence.resource";
import { dev } from "../../resources/dev.resource";
import * as fs from "fs";

describe("Telemetry Persistence Integration", () => {
  const testDbPath = `/tmp/integration-test-${Date.now()}.db`;
  const testSchemaPath = testDbPath.replace('.db', '_schemas.json');

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testSchemaPath)) {
      fs.unlinkSync(testSchemaPath);
    }
  });

  it("should demonstrate complete persistence workflow", async () => {
    const dbConfig = {
      driver: "sqlite" as const,
      options: {
        filePath: testDbPath,
      },
    };

    // 1. Verify configuration validation works
    expect(() => {
      dev.configSchema?.parse({
        port: 3000,
        database: dbConfig,
      });
    }).not.toThrow();

    // 2. Verify resource registration includes database components
    const config = {
      port: 3000,
      maxEntries: 1000,
      database: dbConfig,
    };

    const resources = (dev.register as any)(config);
    
    // Should include enhanced introspector and persistence resources
    expect(resources.length).toBeGreaterThan(8);
    
    const hasDatabase = resources.some(
      (r: any) => r?.id === "runner-dev.database.resources.database" || 
                  r?.definition?.id === "runner-dev.database.resources.database"
    );
    expect(hasDatabase).toBe(true);

    // 3. Verify schema persistence can be initialized
    const persistence = await (schemaPersistence.init as any)(
      { database: dbConfig },
      {},
      {}
    );

    expect(persistence).toBeDefined();
    expect(typeof persistence.saveSchema).toBe('function');
    expect(typeof persistence.loadLatestSchema).toBe('function');

    // 4. Initially no schema should exist
    let restoredIntrospector = await createIntrospectorFromPersistence({ database: dbConfig });
    expect(restoredIntrospector).toBeNull();

    // 5. Save a mock schema
    const mockSchema = {
      tasks: [
        {
          id: "integration.test.task",
          input: null,
          output: null,
          definition: { id: "integration.test.task" },
          kind: "TASK" as const,
          tags: [],
        },
      ],
      hooks: [],
      resources: [],
      events: [],
      middlewares: [],
      tags: [],
    };

    await persistence.saveSchema(mockSchema, "type Query { test: String }");

    // 6. Verify schema can be restored
    restoredIntrospector = await createIntrospectorFromPersistence({ database: dbConfig });
    expect(restoredIntrospector).not.toBeNull();
    expect(restoredIntrospector!.tasks).toHaveLength(1);
    expect(restoredIntrospector!.tasks[0].id).toBe("integration.test.task");

    // 7. Verify file was created
    expect(fs.existsSync(testSchemaPath)).toBe(true);
    
    // 8. Verify file content structure
    const fileContent = JSON.parse(fs.readFileSync(testSchemaPath, 'utf-8'));
    expect(Array.isArray(fileContent)).toBe(true);
    expect(fileContent).toHaveLength(1);
    expect(fileContent[0]).toHaveProperty('id');
    expect(fileContent[0]).toHaveProperty('timestampMs');
    expect(fileContent[0]).toHaveProperty('introspectorData');
    expect(fileContent[0]).toHaveProperty('graphqlSchema');
    expect(fileContent[0]).toHaveProperty('isActive');
    expect(fileContent[0].isActive).toBe(true);
  });

  it("should handle configuration without database gracefully", () => {
    const config = {
      port: 3000,
      maxEntries: 1000,
      // No database configuration
    };

    // Should not throw
    expect(() => {
      const resources = (dev.register as any)(config);
      expect(resources.length).toBe(8); // Base resources only
    }).not.toThrow();
  });

  it("should validate database configuration properly", () => {
    // Valid configuration
    expect(() => {
      dev.configSchema?.parse({
        database: {
          driver: "sqlite",
          options: {
            filePath: "./test.db",
          },
        },
      });
    }).not.toThrow();

    // Invalid driver
    expect(() => {
      dev.configSchema?.parse({
        database: {
          driver: "mysql", // Not supported
          options: {
            filePath: "./test.db",
          },
        },
      });
    }).toThrow();

    // Missing filePath
    expect(() => {
      dev.configSchema?.parse({
        database: {
          driver: "sqlite",
          options: {
            // Missing filePath
          },
        },
      });
    }).toThrow();
  });
});