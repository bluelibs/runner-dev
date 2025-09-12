# Telemetry Persistence with SQLite

This feature adds optional persistence capabilities to Runner-Dev's telemetry system using SQLite and MikroORM.

## Configuration

### Basic Usage (In-Memory)

```typescript
import { dev } from "@bluelibs/runner-dev";

// Standard usage with in-memory telemetry storage
const devTools = dev.with({
  port: 3000,
  maxEntries: 5000,
});
```

### With Database Persistence

```typescript
import { dev } from "@bluelibs/runner-dev";

// Enable SQLite persistence for telemetry and schema data
const devToolsWithPersistence = dev.with({
  port: 3000,
  maxEntries: 10000,
  database: {
    driver: "sqlite",
    options: {
      filePath: "./runner-telemetry.db",
    },
  },
});
```

## Features

### 1. Opt-in Configuration
- Database persistence is completely optional
- When not configured, falls back to existing in-memory storage
- Zero breaking changes to existing usage

### 2. Schema Persistence
When database is configured:
- Introspector data (tasks, resources, hooks, etc.) is automatically saved as snapshots
- Schema snapshots include timestamp and active status
- Latest schema can be restored on server startup
- Enables server to function with persisted schema without requiring full application context

### 3. Future: Telemetry Data Persistence
The framework is prepared for:
- Persisting logs, errors, emissions, and run records to SQLite
- Query capabilities for historical telemetry data
- Automatic data rotation based on maxEntries configuration

## File Structure

When database is configured with `filePath: "./runner-telemetry.db"`:
- `./runner-telemetry.db` - SQLite database (placeholder for future MikroORM integration)
- `./runner-telemetry_schemas.json` - Schema snapshots storage

## API

### Configuration Schema

```typescript
interface DatabaseConfig {
  driver: "sqlite";  // Only SQLite supported currently
  options: {
    filePath: string;  // Path to SQLite database file
  };
}

interface DevConfig {
  port?: number;
  maxEntries?: number;
  database?: DatabaseConfig;  // Optional persistence configuration
}
```

### Schema Persistence

The schema persistence service automatically:
1. Saves introspector snapshots when database is configured
2. Maintains up to 10 historical snapshots
3. Marks the latest snapshot as active
4. Provides API for loading historical schemas

## Example Usage

```typescript
import { runner } from "@bluelibs/runner";
import { dev } from "@bluelibs/runner-dev";

// Your application resources
import { myAppResource } from "./my-app";

export default runner({
  id: "my-app",
  resources: [
    myAppResource,
    
    // Add persistent dev tools
    dev.with({
      port: 3000,
      database: {
        driver: "sqlite",
        options: {
          filePath: "./my-app-telemetry.db",
        },
      },
    }),
  ],
});
```

## Testing

The implementation includes comprehensive tests:
- Database configuration validation
- Schema persistence and retrieval
- Introspector serialization/deserialization
- File-based storage operations
- Resource registration with different configurations

## Future Enhancements

1. **Full MikroORM Integration**: Complete the database entities and migrations
2. **GraphQL Schema Persistence**: Extract and store actual GraphQL schema alongside introspector data
3. **Telemetry Query API**: GraphQL queries for historical telemetry data
4. **Database Migration System**: Handle schema changes across versions
5. **Additional Database Drivers**: PostgreSQL, MySQL support