import { resource } from "@bluelibs/runner";
import { introspector } from "./introspector.resource";
import { DatabaseService, SchemaService, DatabaseConfig } from "../database";

export const schemaPersistence = resource({
  id: "runner-dev.resources.schema-persistence",
  meta: {
    title: "Schema Persistence",
    description:
      "Handles saving and loading of introspector schema to/from database for persistent schema storage",
  },
  dependencies: { introspector },
  async init(config: { database?: DatabaseConfig }, { introspector }) {
    if (!config?.database) {
      // No database configuration, skip schema persistence
      return null;
    }

    const databaseService = new DatabaseService();
    await databaseService.initialize(config.database);
    const schemaService = new SchemaService(databaseService);

    // Save current schema to database
    const currentSchema = {
      tasks: introspector.tasks,
      hooks: introspector.hooks,  
      resources: introspector.resources,
      events: introspector.events,
      middlewares: introspector.middlewares,
      taskMap: introspector.taskMap,
      hookMap: introspector.hookMap,
      resourceMap: introspector.resourceMap,
      eventMap: introspector.eventMap,
      middlewareMap: introspector.middlewareMap,
      tags: introspector.tags,
    };

    // Use a version based on current timestamp or could be derived from package.json version
    const version = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await schemaService.saveSchema(version, currentSchema);

    return {
      schemaService,
      databaseService,
      async getPersistedSchema() {
        return await schemaService.getLatestSchema();
      },
      async saveCurrentSchema() {
        const newVersion = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const schema = {
          tasks: introspector.tasks,
          hooks: introspector.hooks,  
          resources: introspector.resources,
          events: introspector.events,
          middlewares: introspector.middlewares,
          taskMap: introspector.taskMap,
          hookMap: introspector.hookMap,
          resourceMap: introspector.resourceMap,
          eventMap: introspector.eventMap,
          middlewareMap: introspector.middlewareMap,
          tags: introspector.tags,
        };
        await schemaService.saveSchema(newVersion, schema);
        return newVersion;
      }
    };
  },
});