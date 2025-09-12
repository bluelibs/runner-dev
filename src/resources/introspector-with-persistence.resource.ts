import { globals, resource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";
import { DatabaseConfig } from "./database.resource";
import { schemaPersistence } from "./schema-persistence.resource";

export const introspectorWithPersistence = resource({
  id: "runner-dev.resources.introspector-with-persistence",
  meta: {
    title: "Application Introspector with Schema Persistence",
    description: "Analyzes application metadata and optionally persists schema snapshots when database is configured",
  },
  dependencies: (config: { database?: DatabaseConfig }) => {
    const deps: any = {
      store: globals.resources.store,
    };
    
    if (config?.database) {
      deps.schemaPersistence = schemaPersistence;
    }
    
    return deps;
  },
  async init(config: { database?: DatabaseConfig }, deps: any) {
    const i = new Introspector({ store: deps.store });
    initializeFromStore(i, deps.store);
    
    // If schema persistence is available, save the current schema
    if (deps.schemaPersistence && config?.database) {
      try {
        const serializedData = i.serialize();
        // TODO: Get actual GraphQL schema from graphql accumulator
        const graphqlSchema = "# GraphQL Schema would be here";
        
        await deps.schemaPersistence.saveSchema(serializedData, graphqlSchema);
        console.log("Schema snapshot saved to persistence layer");
      } catch (error) {
        console.warn("Failed to save schema snapshot:", error);
      }
    }
    
    return i;
  },
});

// Enhanced introspector that supports schema restoration
export const createIntrospectorFromPersistence = async (config: { database?: DatabaseConfig }) => {
  if (!config?.database) {
    // No database configured, return null to use regular introspector
    return null;
  }
  
  try {
    const persistence = await (schemaPersistence.init as any)(config, {}, {});
    const latestSchema = await persistence.loadLatestSchema();
    
    if (latestSchema) {
      console.log("Restoring schema from persistence:", latestSchema.id);
      return Introspector.deserialize(latestSchema.introspectorData);
    }
  } catch (error) {
    console.warn("Failed to restore schema from persistence:", error);
  }
  
  return null;
};