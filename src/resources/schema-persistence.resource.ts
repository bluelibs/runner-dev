import { resource } from "@bluelibs/runner";
import { DatabaseConfig } from "./database.resource";
import { SerializedIntrospector } from "./models/Introspector";
import * as fs from "fs";
import * as path from "path";

export interface SchemaSnapshot {
  id: string;
  timestampMs: number;
  introspectorData: SerializedIntrospector;
  graphqlSchema: string;
  isActive: boolean;
}

export interface SchemaPersistence {
  saveSchema(introspectorData: SerializedIntrospector, graphqlSchema: string): Promise<void>;
  loadLatestSchema(): Promise<SchemaSnapshot | null>;
  getAllSchemas(): Promise<SchemaSnapshot[]>;
}

class FileSchemaPersistence implements SchemaPersistence {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadSchemas(): SchemaSnapshot[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("Failed to load schemas from file:", error);
      return [];
    }
  }

  private saveSchemas(schemas: SchemaSnapshot[]): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(schemas, null, 2));
    } catch (error) {
      console.error("Failed to save schemas to file:", error);
      throw error;
    }
  }

  async saveSchema(introspectorData: SerializedIntrospector, graphqlSchema: string): Promise<void> {
    const schemas = this.loadSchemas();
    
    // Deactivate previous schemas
    schemas.forEach(schema => {
      schema.isActive = false;
    });

    // Create new snapshot
    const snapshot: SchemaSnapshot = {
      id: `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestampMs: Date.now(),
      introspectorData,
      graphqlSchema,
      isActive: true,
    };

    schemas.push(snapshot);

    // Keep only last 10 snapshots
    if (schemas.length > 10) {
      schemas.splice(0, schemas.length - 10);
    }

    this.saveSchemas(schemas);
  }

  async loadLatestSchema(): Promise<SchemaSnapshot | null> {
    const schemas = this.loadSchemas();
    const activeSchema = schemas.find(s => s.isActive);
    
    if (activeSchema) {
      return activeSchema;
    }

    // If no active schema, return the most recent one
    if (schemas.length > 0) {
      return schemas[schemas.length - 1];
    }

    return null;
  }

  async getAllSchemas(): Promise<SchemaSnapshot[]> {
    return this.loadSchemas();
  }
}

export const schemaPersistence = resource({
  id: "runner-dev.schema.resources.schemaPersistence",
  meta: {
    title: "Schema Persistence Service",
    description:
      "Service for persisting and retrieving GraphQL schema and introspector data snapshots",
  },
  async init(config: { database?: DatabaseConfig }): Promise<SchemaPersistence> {
    if (config?.database) {
      // Use database file path as base for schema storage
      const schemaFilePath = config.database.options.filePath.replace(/\.db$/, '_schemas.json');
      return new FileSchemaPersistence(schemaFilePath);
    }
    
    // Default to local file storage
    return new FileSchemaPersistence('./runner-dev-schemas.json');
  },
});