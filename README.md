### README for @bluelibs/runner-dev

Runner Dev Tools provide introspection, live telemetry, and a GraphQL API to explore and query your running Runner app.

## Install

```bash
npm install @bluelibs/runner-dev
```

## What you get

- Introspector: programmatic API to inspect tasks, listeners, resources, events, middleware, and diagnostics
- Live: in-memory logs and event emissions
- GraphQL server: deep graph navigation over your app’s topology and live data

## Quickstart

Register the Dev resources in your Runner root:

```ts
import { resource } from "@bluelibs/runner";
import { resources as dev } from "@bluelibs/runner-dev";

export const app = resource({
  id: "app",
  register: [
    // Live telemetry provider (logs + emissions)
    dev.live,

    // In-memory introspection API
    dev.introspector,

    // GraphQL server to expose introspection + live
    dev.server.with({ port: 2000 }),
  ],
});
```

Then start your app as usual. The Dev GraphQL server will be available at http://localhost:2000/graphql.

## Programmatic Introspection (without GraphQL)

```ts
import { resource } from "@bluelibs/runner";
import type { Introspector } from "@bluelibs/runner-dev/dist/resources/introspector.resource";
import { introspector } from "@bluelibs/runner-dev/dist/resources/introspector.resource";

export const probe = resource({
  id: "probe",
  dependencies: { introspector },
  async init(_c, { introspector }: { introspector: Introspector }) {
    const tasks = introspector.getTasks(); // Task[]
    const listeners = introspector.getListeners(); // Listener[]
    const resources = introspector.getResources(); // Resource[]
    const events = introspector.getEvents(); // Event[]
    const middlewares = introspector.getMiddlewares(); // Middleware[]

    const deps = introspector.getDependencies(tasks[0]); // tasks/listeners/resources/emitters

    // Diagnostics
    const diagnostics = introspector.getDiagnostics();
    // Or granular helpers
    // introspector.getOrphanEvents();
    // introspector.getUnemittedEvents();
    // introspector.getUnusedMiddleware();
    // introspector.getMissingFiles();
    // introspector.getOverrideConflicts();
  },
});
```

## GraphQL API Highlights

All arrays are non-null lists with non-null items, and ids are complemented by resolved fields for deep traversal.

- Common

  - `BaseElement`: `id: ID!`, `meta: Meta`, `filePath: String`
  - `Meta`: `title: String`, `description: String`, `tags: [String!]!`

- Query root

  - `all: All`
  - `event(id: ID!): Event`, `events: [Event!]!`
  - `task(id: ID!): Task`, `tasks: [Task!]!`
  - `listeners: [Listener!]!`
  - `middleware(id: ID!): Middleware`, `middlewares: [Middleware!]!`
  - `resource(id: ID!): Resource`, `resources: [Resource!]!`
  - `live: Live!`
  - `diagnostics: [Diagnostic!]!`

- All

  - `id`, `meta`, `filePath`, `fileContents`, `markdownDescription`

- Tasks/Listeners (TaskInterface implemented by `Task` and `Listener`)

  - `emits: [String!]!`, `emitsResolved: [Event!]!`
  - `dependsOn: [String!]!`
  - `middleware: [String!]!`, `middlewareResolved: [Middleware!]!`, `middlewareResolvedDetailed: [TaskMiddlewareUsage!]!`
  - `overriddenBy: String` (if overridden)
  - Task-specific: `dependsOnResolved { tasks, listeners, resources, emitters }`
  - Listener-specific: `event: String!`, `listenerOrder: Int`, `dependsOnResolved {…}`

- Resources

  - `config: String`, `context: String`
  - `middleware`, `middlewareResolved`, `middlewareResolvedDetailed`
  - `overrides`, `overridesResolved`
  - `registers`, `registersResolved`
  - `usedBy: [TaskInterface!]!`
  - `emits: [Event!]!` (inferred from task/listener emissions)

- Events

  - `emittedBy: [String!]!`, `emittedByResolved: [TaskInterface!]!`
  - `listenedToBy: [String!]!`, `listenedToByResolved: [TaskInterface!]!`

- Middleware

  - `global: GlobalMiddleware` (flags: `enabled`, `tasks`, `resources`)
  - `usedByTasks`, `usedByTasksResolved`, `usedByTasksDetailed: [MiddlewareTaskUsage!]!`
  - `usedByResources`, `usedByResourcesResolved`, `usedByResourcesDetailed: [MiddlewareResourceUsage!]!`
  - `emits: [Event!]!` (events from task/listener nodes using this middleware)
  - `overriddenBy: String`

- Live

  - `logs(afterTimestamp: Float, last: Int, filter: LogFilterInput): [LogEntry!]!`
    - `LogEntry { timestampMs, level, message, data }`
    - `LogFilterInput { levels: [LogLevelEnum!], messageIncludes: String }`
  - `emissions(afterTimestamp: Float, last: Int, filter: EmissionFilterInput): [EmissionEntry!]!`
    - `EmissionEntry { timestampMs, eventId, emitterId, payload }`
    - `EmissionFilterInput { eventIds: [String!], emitterIds: [String!] }`
  - `errors(afterTimestamp: Float, last: Int, filter: ErrorFilterInput): [ErrorEntry!]!`
    - `ErrorEntry { timestampMs, sourceId, sourceKind, message, stack, data }`
    - `ErrorFilterInput { sourceKinds: [SourceKindEnum!], sourceIds: [ID!], messageIncludes: String }`
  - `runs(afterTimestamp: Float, last: Int, filter: RunFilterInput): [RunRecord!]!`
    - `RunRecord { timestampMs, nodeId, nodeKind, durationMs, ok, error }`
    - `RunFilterInput { nodeKinds: [NodeKindEnum!], nodeIds: [String!], ok: Boolean }`

  Enums: `LogLevelEnum` = `trace|debug|info|warn|error|fatal|log`, `SourceKindEnum` = `TASK|LISTENER|RESOURCE|MIDDLEWARE|INTERNAL`, `NodeKindEnum` = `TASK|LISTENER`.

- Diagnostics

  - `Diagnostic { severity: String!, code: String!, message: String!, nodeId: ID, nodeKind: String }`
  - Exposed via `diagnostics: [Diagnostic!]!` on the root query; diagnostics are computed from the in-memory introspected graph with safe filesystem checks.
  - Example codes: `ORPHAN_EVENT`, `UNEMITTED_EVENT`, `UNUSED_MIDDLEWARE`, `MISSING_FILE`, `OVERRIDE_CONFLICT`.

### Example Queries

- Explore tasks and dependencies deeply

```graphql
query {
  tasks {
    id
    filePath
    emits
    emitsResolved {
      id
    }
    dependsOn
    middleware
    middlewareResolved {
      id
    }
    dependsOnResolved {
      tasks {
        id
      }
      listeners {
        id
      }
      resources {
        id
      }
      emitters {
        id
      }
    }
  }
}
```

- Diagnostics

```graphql
query {
  diagnostics {
    severity
    code
    message
    nodeId
    nodeKind
  }
}
```

- Traverse from middleware to dependents, then back to their middleware

```graphql
query {
  middlewares {
    id
    usedByTasksResolved {
      id
      middlewareResolved {
        id
      }
    }
    usedByResourcesResolved {
      id
    }
    emits {
      id
    }
  }
}
```

- Events and listeners

```graphql
query {
  events {
    id
    emittedBy
    emittedByResolved {
      id
    }
    listenedToBy
    listenedToByResolved {
      id
    }
  }
}
```

## Live Telemetry

The `live` resource records:

- Logs emitted via `globals.events.log`
- All event emissions (via an internal global `on: "*"` listener)

GraphQL (basic):

```graphql
query {
  live {
    logs(afterTimestamp: 0) {
      timestampMs
      level
      message
      data # stringified JSON if object, otherwise null
    }
    emissions(afterTimestamp: 0) {
      timestampMs
      eventId
      emitterId
      payload # stringified JSON if object, otherwise null
    }
    errors(afterTimestamp: 0) {
      timestampMs
      sourceId
      sourceKind
      message
    }
    runs(afterTimestamp: 0) {
      timestampMs
      nodeId
      nodeKind
      durationMs
      ok
    }
  }
}
```

Filter by timestamp (ms) to retrieve only recent entries.

GraphQL (with filters and last):

```graphql
query {
  live {
    logs(
      last: 100
      filter: { levels: [debug, error], messageIncludes: "probe" }
    ) {
      timestampMs
      level
      message
    }
    emissions(
      last: 50
      filter: { eventIds: ["evt.hello"], emitterIds: ["task.id"] }
    ) {
      eventId
      emitterId
    }
    errors(
      last: 10
      filter: { sourceKinds: [TASK, RESOURCE], messageIncludes: "boom" }
    ) {
      sourceKind
      message
    }
    runs(afterTimestamp: 0, last: 5, filter: { ok: true, nodeKinds: [TASK] }) {
      nodeId
      durationMs
      ok
    }
  }
}
```

## Emitting Events (Runner-native)

- Define an event:

```ts
import { event } from "@bluelibs/runner";

export const userCreated = event<{ id: string; name: string }>({
  id: "evt.user.created",
});
```

- Use it in a task:

```ts
import { task } from "@bluelibs/runner";
import { userCreated } from "./events";

export const createUser = task({
  id: "task.user.create",
  dependencies: { userCreated },
  async run(input: { name: string }, { userCreated }) {
    const id = crypto.randomUUID();
    await userCreated({ id, name: input.name });
    return { id };
  },
});
```

- Emit logs:

```ts
import { globals, task } from "@bluelibs/runner";

export const logSomething = task({
  id: "task.log",
  dependencies: { logger: globals.resources.logger },
  async run(_i, { logger }) {
    logger.info("Hello world!");
  },
});
```

## Notes on Overrides

- If a resource overrides another registerable, the overridden node remains discoverable but marked with `overriddenBy`.
- Only the active definition exists; we do not retain a shadow copy of the original.

## Guarantees and DX

- No `any` in APIs; strong types for nodes and relations
- Non-null lists with non-null items (`[T!]!`) in GraphQL
- Deep “resolved” fields for easy graph traversal
- File-aware enhancements:
  - `filePath` everywhere
  - `fileContents` and `markdownDescription` on `all` (computed on demand)

## Development

- Library targets `@bluelibs/runner` v3+
- GraphQL built with Apollo Server 5
- Tests cover:
  - Node discovery, dependencies, and emissions
  - Overrides, middleware usage, and deep traversal
  - Live logs and emissions (with timestamp filtering)
- Contributions welcome!

### Type-safe GraphQL resolvers

- We generate resolver arg types from the schema using GraphQL Code Generator.
- Run this after any schema change:

```bash
npm run codegen
```

- Generated types are in `src/generated/resolvers-types.ts` and used in schema resolvers (for example `LiveLogsArgs`, `QueryEventArgs`).
