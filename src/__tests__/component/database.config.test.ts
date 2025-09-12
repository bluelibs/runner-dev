import { describe, it, expect } from "@jest/globals";
import { dev } from "../../resources/dev.resource";
import { database } from "../../resources/database.resource";

describe("Database Configuration", () => {
  it("should accept database configuration in dev resource", () => {
    const config = {
      port: 3000,
      maxEntries: 5000,
      database: {
        driver: "sqlite" as const,
        options: {
          filePath: "./telemetry.db",
        },
      },
    };

    // Should not throw validation error
    expect(() => {
      dev.configSchema?.parse(config);
    }).not.toThrow();
  });

  it("should validate database configuration schema", () => {
    const validConfig = {
      driver: "sqlite" as const,
      options: {
        filePath: "./test.db",
      },
    };

    // Should pass validation
    expect(() => {
      database.configSchema?.parse(validConfig);
    }).not.toThrow();
  });

  it("should reject invalid database driver", () => {
    const invalidConfig = {
      driver: "mysql", // Only sqlite is supported currently
      options: {
        filePath: "./test.db",
      },
    };

    // Should throw validation error
    expect(() => {
      database.configSchema?.parse(invalidConfig);
    }).toThrow();
  });

  it("should require filePath in options", () => {
    const invalidConfig = {
      driver: "sqlite" as const,
      options: {
        // Missing filePath
      },
    };

    // Should throw validation error
    expect(() => {
      database.configSchema?.parse(invalidConfig);
    }).toThrow();
  });

  it("should register database resource when configured", () => {
    const config = {
      database: {
        driver: "sqlite" as const,
        options: {
          filePath: "./test.db",
        },
      },
    };

    const resources = (dev.register as any)(config);
    
    // Should include database resource
    expect(resources.length).toBeGreaterThan(8); // At least the base resources + database
    
    // Check that database resource is included
    const hasDatabase = resources.some(
      (r: any) => r?.id === "runner-dev.database.resources.database" || 
                  r?.definition?.id === "runner-dev.database.resources.database"
    );
    expect(hasDatabase).toBe(true);
  });

  it("should not register database resource when not configured", () => {
    const config = {
      port: 3000,
      maxEntries: 5000,
    };

    const resources = (dev.register as any)(config);
    
    // Should only include base resources
    expect(resources.length).toBe(8); // Only the base resources
    
    // Check that database resource is not included
    const hasDatabase = resources.some(
      (r: any) => r?.id === "runner-dev.database.resources.database" || 
                  r?.definition?.id === "runner-dev.database.resources.database"
    );
    expect(hasDatabase).toBe(false);
  });
});