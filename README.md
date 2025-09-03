## Welcome

Runner Dev Tools provide introspection, live telemetry, and a GraphQL API to explore and query your running Runner app.

The way it works, is that this is a resource that opens a graphql server which opens your application to introspection.

## Install

```bash
npm install -g @bluelibs/runner-dev
# or
npx @bluelibs/runner-dev
```

```ts
import { dev } from "@bluelibs/runner-dev";

const app = resource({
  register: [
    // your resources,
    dev, // if you are fine with defaults or
    dev.with({
      port: 1337, // default,
      maxEntries: 10000, // how many logs to keep in the store.
    }),
  ],
});
```

## What you get

- Introspector: programmatic API to inspect tasks, hooks, resources, events, middleware, and diagnostics (including file paths, contents)
- Live: in-memory logs and event emissions
- GraphQL server: deep graph navigation over your app’s topology and live data
- MCP server: allow your AI to do introspection for you.

## Quickstart

Register the Dev resources in your Runner root:

```ts
import { resource } from "@bluelibs/runner";
import { dev } from "@bluelibs/runner-dev";

const register = [
  // rest of your app elements
];

if (process.env.DEV_MODE) {
  register.push(dev);
}

export const app = resource({
  id: "app",
  register: [
    // You can omit .with() if you are fine with defaults.
    dev.with({
      port: 1337, // default
      maxEntries: 1000, // default
    }),
    // rest of your app.
  ],
});
```

Add it as an MCP Server:

```json
{
  "mcpServers": {
    "mcp-graphql": {
      "description": "MCP Server for Active Running Context App",
      "command": "npx",
      "args": ["runner-dev", "mcp"],
      "env": {
        "ENDPOINT": "http://localhost:1337/graphql",
        "ALLOW_MUTATIONS": "true"
      }
    }
  }
}
```

Then start your app as usual. The Dev GraphQL server will be available at http://localhost:1337/graphql.

### CLI usage (MCP server)

After installing, you can start the MCP server from this package via stdio.

Using npx:

```bash
ENDPOINT=http://localhost:1337/graphql npx -y @bluelibs/runner-dev mcp
```

Optional environment variables:

- `ALLOW_MUTATIONS=true` to enable `graphql.mutation`
- `HEADERS='{"Authorization":"Bearer token"}'` to pass extra headers

Available tools once connected:

- `graphql.query` — run read-only queries
- `graphql.mutation` — run mutations (requires `ALLOW_MUTATIONS=true`)
- `graphql.introspect` — fetch schema
- `graphql.ping` — reachability check
- `project.overview` — dynamic Markdown overview aggregated from the API

### CLI usage (direct)

This package also ships a CLI that can query the same GraphQL API or generate an overview directly from your terminal.

Prerequisites:

- Ensure your app registers the Dev GraphQL server (`dev.with({ port: 1337 })`) or otherwise expose a compatible endpoint.
- Alternatively, you can run queries in a new **dry‑run mode** with a TypeScript entry file (no server required).
- Build this package (or install it) so the binary is available.

Help:

```bash
npx @bluelibs/runner-dev --help
```

Run CLI from TypeScript (no build):

```bash
# Using ts-node ESM loader
node --loader ts-node/esm src/cli.ts query 'query { tasks { id } }' --entry-file ./src/main.ts

# Or with tsx (recommended DX)
npx tsx src/cli.ts query 'query { tasks { id } }' --entry-file ./src/main.ts

# Or classic ts-node when configured
npx ts-node src/cli.ts query 'query { tasks { id } }' --entry-file ./src/main.ts
```

Create new project:

```bash
# Create a new Runner project
npx @bluelibs/runner-dev new <project-name>

# Example
npx @bluelibs/runner-dev new my-awesome-app
```

This command creates a new Runner project with:

- Complete TypeScript setup with ts-node-dev for development
- Jest configuration for testing
- Package.json with all necessary dependencies
- Basic project structure with main.ts entry point
- README and .gitignore files

Flags for `new`:

- `--install`: install dependencies after scaffolding
- `--run-tests`: run the generated test suite (`npm test -- --runInBand`) after install
- `--run`: start the dev server (`npm run dev`) after install/tests; this keeps the process running

Examples:

```bash
# Create and auto-install dependencies, then run tests
npx @bluelibs/runner-dev new my-awesome-app --install --run-tests

# Create and start the dev server immediately (blocks)
npx @bluelibs/runner-dev new my-awesome-app --install --run
```

Scaffold artifacts (resource | task | event | tag | taskMiddleware | resourceMiddleware):

```bash
# General form
npx @bluelibs/runner-dev new <kind> <name> [--ns app] [--dir src] [--export] [--dry]

# Examples
npx @bluelibs/runner-dev new resource user-service --ns app --dir src --export
npx @bluelibs/runner-dev new task create-user --ns app.users --dir src --export
npx @bluelibs/runner-dev new event user-registered --ns app.users --dir src --export
npx @bluelibs/runner-dev new tag http --ns app.web --dir src --export
npx @bluelibs/runner-dev new taskMiddleware auth --ns app --dir src --export
npx @bluelibs/runner-dev new resourceMiddleware soft-delete --ns app --dir src --export
```

Flags for artifact scaffolding:

- `--ns` / `--namespace`: namespace used when generating the id (default: `app`)
- `--id <id>`: explicit id override (for example: `app.tasks.save`)
- `--dir <dir>`: base directory under which files are created (default: `src`)
- `--export`: append a re-export to an `index.ts` in the target folder for better auto-import UX
- `--dry` / `--dry-run`: print the generated file without writing it

Conventions:

- Generated ids follow: `<namespace>.(resources|tasks|events|tags|middleware).<kebab-name>`
- Folders:
  - resources: `src/resources`
  - tasks: `src/tasks`
  - events: `src/events`
  - tags: `src/tags`
  - task middleware: `src/middleware/task`
  - resource middleware: `src/middleware/resource`
- The `--export` flag will add `export * from './<name>';` to the folder's `index.ts` (created if missing).

Tip: run `npx @bluelibs/runner-dev new help` to see the full usage and examples for artifact scaffolding.

Note: the `new` command requires the target directory to be empty. If the directory exists and is not empty, the command aborts with an error.

The project name must contain only letters, numbers, dashes, and underscores.

After creation, follow the next steps:

- `cd <project-name>`
- `npm install`
- `npm run dev`

Ping endpoint:

```bash
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev ping
```

Run a query (two modes):

```bash
# Remote mode (HTTP endpoint)
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev query 'query { tasks { id } }'

# With variables and pretty output
ENDPOINT=http://localhost:1337/graphql \
  npx @bluelibs/runner-dev query \
  'query Q($ns: ID){ tasks(idIncludes: $ns) { id } }' \
  --variables '{"ns":"task."}' \
  --format pretty

# Add a namespace sugar to inject idIncludes/filter automatically
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev query 'query { tasks { id } }' --namespace task.

# Dry‑run mode (no server) — uses a TS entry file
npx @bluelibs/runner-dev query 'query { tasks { id } }' --entry-file ./src/main.ts
```

Dry‑run (no server) details:

```bash
# Using a TS entry file default export
npx @bluelibs/runner-dev query 'query { tasks { id } }' \
  --entry-file ./src/main.ts

# Using a named export (e.g., exported as `app`)
npx @bluelibs/runner-dev query 'query { tasks { id } }' \
  --entry-file ./src/main.ts --export app

# Notes
# - Dry‑run compiles your entry, builds the Runner Store in-memory, and executes the query against
#   an in-memory GraphQL schema. No HTTP server is started.
# - TypeScript only. Requires ts-node at runtime. If missing, you'll be prompted to install it.
# - Selection logic:
#   - If --entry-file is provided, dry‑run mode is used (no server).
#   - Otherwise, remote mode is used via --endpoint or ENDPOINT/GRAPHQL_ENDPOINT.
#   - If neither an endpoint nor an entry file is provided, the command errors.
```

Project overview (Markdown):

```bash
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev overview --details 10 --include-live
```

Schema tools:

```bash
# SDL string
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev schema sdl

# Introspection JSON
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev schema json
```

Environment variables used by all commands:

- `ENDPOINT` (or `GRAPHQL_ENDPOINT`): GraphQL endpoint URL
- `HEADERS`: JSON for extra headers, e.g. `{"Authorization":"Bearer ..."}`

Flags:

- `--endpoint <url>`: override endpoint
- `--headers '<json>'`: override headers
- `--variables '<json>'`: JSON variables for query
- `--operation <name>`: operation name for documents with multiple operations
- `--format data|json|pretty`: output mode (default `data`)
- `--raw`: print full GraphQL envelope including errors
- `--namespace <str>`: convenience filter that injects `idIncludes` or `events(filter: { idIncludes })` at the top-level fields when possible
- `--entry-file <path>`: TypeScript entry file for dry‑run mode (no server)
- `--export <name>`: named export to use from the entry (default export preferred)

Precedence:

- If `--entry-file` is present, dry‑run mode is used.
- Otherwise, remote mode via `--endpoint`/`ENDPOINT` is used.

### Local dev playbook

Quickly boot the dummy server and UI, then exercise the CLI against it.

1. Start dev play (UI + Server):

```bash
npm run play
```

This starts:

- UI watcher (`vite build --watch`)
- Dummy GraphQL server with Dev resources on port 31337

2. In another terminal, build the CLI and run demo commands:

```bash
npm run build
npm run demo:ping
npm run demo:query
npm run demo:overview
```

Alternatively, you can keep a server-only process:

```bash
npm run play:cli
# Then:
npm run demo:query
```

### Testing

- Unit/integration tests are executed via Jest: `npm test`.
- CLI remote tests spin up the dummy app on ephemeral ports and dispose cleanly.

Run only the CLI tests:

```bash
npm test -- src/__tests__/component/cli.query.remote.test.ts src/__tests__/component/cli.overview.remote.test.ts
```

CI note: we prebuild before tests via `pretest` so the CLI binary `dist/cli.js` is available.

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
    const hooks = introspector.getHooks(); // Hook[]
    const resources = introspector.getResources(); // Resource[]
    const events = introspector.getEvents(); // Event[]
    const middlewares = introspector.getMiddlewares(); // Middleware[]

    const deps = introspector.getDependencies(tasks[0]); // tasks/hooks/resources/emitters

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

  - `BaseElement`: `id: ID!`, `meta: Meta`, `filePath: String`, `markdownDescription: String!`, `fileContents(startLine: Int, endLine: Int): String`
  - `Meta`: `title: String`, `description: String`, `tags: [MetaTagUsage!]!`
  - `MetaTagUsage`: `id: ID!`, `config: String`

- Query root

  - `all(idIncludes: ID): [BaseElement!]!`
  - `event(id: ID!): Event`, `events(filter: EventFilterInput): [Event!]!`
  - `task(id: ID!): Task`, `tasks(idIncludes: ID): [Task!]!`
  - `hooks(idIncludes: ID): [Hook!]!`
  - `middleware(id: ID!): Middleware`, `middlewares(idIncludes: ID): [Middleware!]!`
  - `taskMiddlewares(idIncludes: ID): [TaskMiddleware!]!`
  - `resourceMiddlewares(idIncludes: ID): [ResourceMiddleware!]!`
  - `resource(id: ID!): Resource`, `resources(idIncludes: ID): [Resource!]!`
  - `root: Resource`
  - `swappedTasks: [SwappedTask!]!`
  - `live: Live!`
  - `diagnostics: [Diagnostic!]!`
  - `tag(id: ID!): Tag`
  - `tags: [Tag!]!`

- All

  - `id`, `meta`, `filePath`, `fileContents`, `markdownDescription`, `tags: [Tag!]!`

- Tasks/Hooks

  - Shared: `emits: [String!]!`, `emitsResolved: [Event!]!`, `runs: [RunRecord!]!`, `tags: [Tag!]!`
  - Shared: `dependsOn: [String!]!`
  - Shared: `middleware: [String!]!`, `middlewareResolved: [TaskMiddleware!]!`, `middlewareResolvedDetailed: [TaskMiddlewareUsage!]!`
  - Shared: `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
  - Task-specific: `inputSchema: String`, `inputSchemaReadable: String`, `dependsOnResolved { tasks { id } hooks { id } resources { id } emitters { id } }`
  - Hook-specific: `event: String!`, `hookOrder: Int`, `inputSchema: String`, `inputSchemaReadable: String`

- Resources

  - `config: String`, `context: String`, `configSchema: String`, `configSchemaReadable: String`
  - `middleware`, `middlewareResolved: [ResourceMiddleware!]!`, `middlewareResolvedDetailed: [TaskMiddlewareUsage!]!`
  - `overrides`, `overridesResolved`
  - `registers`, `registersResolved`
  - `usedBy: [Task!]!`
  - `emits: [Event!]!` (inferred from task/hook emissions)
  - `dependsOn: [String!]!`, `dependsOnResolved: [Resource!]!`
  - `registeredBy: String`, `registeredByResolved: Resource`
  - `tags: [Tag!]!`

- Events

  - `emittedBy: [String!]!`, `emittedByResolved: [BaseElement!]!`
  - `listenedToBy: [String!]!`, `listenedToByResolved: [Hook!]!`
  - `payloadSchema: String`, `payloadSchemaReadable: String`
  - `registeredBy: String`, `registeredByResolved: Resource`
  - `tags: [Tag!]!`

- TaskMiddleware

  - `global: GlobalMiddleware`
  - `usedBy: [Task!]!`, `usedByDetailed: [MiddlewareTaskUsage!]!`
  - `emits: [Event!]!`
  - `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
  - `configSchema: String`, `configSchemaReadable: String`
  - `tags: [Tag!]!`

- ResourceMiddleware

  - `global: GlobalMiddleware`
  - `usedBy: [Resource!]!`, `usedByDetailed: [MiddlewareResourceUsage!]!`
  - `emits: [Event!]!`
  - `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
  - `configSchema: String`, `configSchemaReadable: String`
  - `tags: [Tag!]!`

- Live

  - `logs(afterTimestamp: Float, last: Int, filter: LogFilterInput): [LogEntry!]!`
    - `LogEntry { timestampMs, level, message, data, correlationId }`
    - `LogFilterInput { levels: [LogLevelEnum!], messageIncludes: String, correlationIds: [String!] }`
  - `emissions(afterTimestamp: Float, last: Int, filter: EmissionFilterInput): [EmissionEntry!]!`
    - `EmissionEntry { timestampMs, eventId, emitterId, payload, correlationId, emitterResolved: BaseElement, eventResolved: Event }`
    - `EmissionFilterInput { eventIds: [String!], emitterIds: [String!], correlationIds: [String!] }`
  - `errors(afterTimestamp: Float, last: Int, filter: ErrorFilterInput): [ErrorEntry!]!`
    - `ErrorEntry { timestampMs, sourceId, sourceKind, message, stack, data, correlationId, sourceResolved: BaseElement }`
    - `ErrorFilterInput { sourceKinds: [SourceKindEnum!], sourceIds: [ID!], messageIncludes: String, correlationIds: [String!] }`
  - `runs(afterTimestamp: Float, last: Int, filter: RunFilterInput): [RunRecord!]!`
    - `RunRecord { timestampMs, nodeId, nodeKind, durationMs, ok, error, parentId, rootId, correlationId, nodeResolved: BaseElement }`
    - `RunFilterInput { nodeKinds: [NodeKindEnum!], nodeIds: [String!], ok: Boolean, parentIds: [String!], rootIds: [String!], correlationIds: [String!] }`

  Enums: `LogLevelEnum` = `trace|debug|info|warn|error|fatal|log`, `SourceKindEnum` = `TASK|HOOK|RESOURCE|MIDDLEWARE|INTERNAL`, `NodeKindEnum` = `TASK|HOOK`.

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

- Events and hooks

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
- All event emissions (via an internal global `on: "*"` hook)

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
      parentId
      rootId
      correlationId
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
      correlationId
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
      correlationId
    }
  }
}
```

### Live system health

- **memory: `MemoryStats!`**
  - Fields: `heapUsed` (bytes), `heapTotal` (bytes), `rss` (bytes)
- **cpu: `CpuStats!`**
  - Fields: `usage` (0..1 event loop utilization), `loadAverage` (1‑minute load avg)
- **eventLoop(reset: Boolean): `EventLoopStats!`**
  - Fields: `lag` (ms, avg delay via `monitorEventLoopDelay`)
  - Args: `reset` optionally clears the histogram after reading
- **gc(windowMs: Float): `GcStats!`**
  - Fields: `collections` (count), `duration` (ms)
  - Args: `windowMs` returns stats only within the last window; omitted = totals since process start

Example query:

```graphql
query SystemHealth {
  live {
    memory {
      heapUsed
      heapTotal
      rss
    }
    cpu {
      usage
      loadAverage
    }
    eventLoop(reset: true) {
      lag
    }
    gc(windowMs: 10000) {
      collections
      duration
    }
  }
}
```

Notes:

- `heap*` and `rss` are bytes.
- `cpu.usage` is a ratio; `loadAverage` is 1‑minute OS load.
- `eventLoop.lag` may be 0 if `monitorEventLoopDelay` is unavailable.

### Correlation and call chains

- What is correlationId? An opaque UUID (via `crypto.randomUUID()`) created for the first task in a run chain.
- How is it formed?
  - When a task starts, a middleware opens an AsyncLocalStorage scope containing:
    - `correlationId`: a UUID for the chain
    - `chain`: ordered array of node ids representing the call path
  - Nested tasks and listeners reuse the same AsyncLocalStorage scope, so the same `correlationId` flows throughout the chain.
- What does it contain? Only a UUID string. No payload, no PII.
- Where is it recorded?
  - `logs.correlationId`
  - `emissions.correlationId`
  - `errors.correlationId`
  - `runs.correlationId` plus `runs.parentId` and `runs.rootId` for chain topology
- How to use it
  - Read a recent run to discover a correlation id, then filter logs by it:

```graphql
query TraceByCorrelation($ts: Float, $cid: String!) {
  live {
    runs(afterTimestamp: $ts, last: 10) {
      nodeId
      parentId
      rootId
      correlationId
    }
    logs(last: 100, filter: { correlationIds: [$cid] }) {
      timestampMs
      level
      message
      correlationId
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

- Library targets `@bluelibs/runner` v4+
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

## 🔥 Hot-Swapping Debugging System

**Revolutionary live debugging feature that allows AI assistants and developers to dynamically replace task run functions in live applications.**

### Overview

The hot-swapping system enables:

- **Live Function Replacement**: Replace any task's `run` function with new TypeScript/JavaScript code without restarting the application
- **TypeScript Compilation**: Automatic compilation and validation of swapped code
- **GraphQL API**: Remote swap operations via GraphQL mutations
- **Live Telemetry Integration**: Real-time capture of debug logs from swapped functions
- **Rollback Support**: Easy restoration to original functions
- **Type Safety**: 100% type-safe implementation with comprehensive error handling

### Quick Setup

Add the swap manager to your app:

```ts
import { resource } from "@bluelibs/runner";
import { resources as dev } from "@bluelibs/runner-dev";

export const app = resource({
  id: "app",
  register: [
    // Core dev resources
    dev.live,
    dev.introspector,

    // Add the swap manager for hot-swapping
    dev.swapManager,

    // GraphQL server with swap mutations
    dev.server.with({ port: 1337 }),
  ],
});
```

### GraphQL API

#### Queries

**Get currently swapped tasks:**

```graphql
query {
  swappedTasks {
    taskId
    swappedAt
    originalCode
  }
}
```

#### Mutations

**Swap a task's run function:**

```graphql
mutation SwapTask($taskId: ID!, $runCode: String!) {
  swapTask(taskId: $taskId, runCode: $runCode) {
    success
    error
    taskId
  }
}
```

**Restore original function:**

```graphql
mutation UnswapTask($taskId: ID!) {
  unswapTask(taskId: $taskId) {
    success
    error
    taskId
  }
}
```

**Restore all swapped tasks:**

```graphql
mutation UnswapAllTasks {
  unswapAllTasks {
    success
    error
    taskId
  }
}
```

### Usage Examples

#### Basic Function Swapping

Replace a task's logic with enhanced debugging:

```graphql
mutation {
  swapTask(
    taskId: "user.create"
    runCode: """
    async function run(input, deps) {
      // Add comprehensive logging
      if (deps.emitLog) {
        await deps.emitLog({
          timestamp: new Date(),
          level: "info",
          message: "🔍 DEBUG: Creating user started",
          data: { input }
        });
      }

      // Enhanced validation
      if (!input.email || !input.email.includes('@')) {
        throw new Error('Invalid email address');
      }

      // Original logic with debugging
      const result = {
        id: crypto.randomUUID(),
        email: input.email,
        createdAt: new Date().toISOString(),
        debugInfo: {
          swappedAt: Date.now(),
          inputValidated: true
        }
      };

      if (deps.emitLog) {
        await deps.emitLog({
          timestamp: new Date(),
          level: "info",
          message: "🔍 DEBUG: User created successfully",
          data: { result }
        });
      }

      return result;
    }
    """
  ) {
    success
    error
  }
}
```

#### TypeScript Support

The system supports full TypeScript syntax:

```graphql
mutation {
  swapTask(
    taskId: "data.processor"
    runCode: """
    async function run(input: { items: string[] }, deps: any): Promise<{ processed: number }> {
      const items: string[] = input.items || [];
      let processed: number = 0;

      for (const item of items) {
        if (typeof item === 'string' && item.length > 0) {
          processed++;
        }
      }

      return { processed };
    }
    """
  ) {
    success
    error
  }
}
```

#### Arrow Functions and Function Bodies

Multiple code formats are supported:

```graphql
# Arrow function
mutation {
  swapTask(
    taskId: "simple.task"
    runCode: "() => ({ message: 'Hello from arrow function!' })"
  ) {
    success
  }
}

# Function body only
mutation {
  swapTask(
    taskId: "another.task"
    runCode: """
    const result = { timestamp: Date.now() };
    return result;
    """
  ) {
    success
  }
}
```

### Live Telemetry Integration

Swapped functions can emit logs that are captured by the live telemetry system:

```graphql
# After swapping with debug logging, query the logs
query RecentDebugLogs {
  live {
    logs(last: 50, filter: { messageIncludes: "🔍 DEBUG" }) {
      timestampMs
      level
      message
      data
      correlationId
    }
  }
}
```

### Programmatic Usage

Use the swap manager directly in your code:

```ts
import { resource } from "@bluelibs/runner";
import type { SwapManager } from "@bluelibs/runner-dev/dist/resources/swap.resource";
import { swapManager } from "@bluelibs/runner-dev/dist/resources/swap.resource";

export const debugger = resource({
  id: "my.debugger",
  dependencies: { swapManager },
  async init(_c, { swapManager }: { swapManager: SwapManager }) {
    // Swap a task programmatically
    const result = await swapManager.swap("user.create", `
      async function run(input, deps) {
        console.log("Debug: Enhanced user creation");
        return { id: "debug-user", ...input };
      }
    `);

    if (result.success) {
      console.log(`Task ${result.taskId} swapped successfully`);
    } else {
      console.error(`Swap failed: ${result.error}`);
    }

    // Check what's currently swapped
    const swappedTasks = swapManager.getSwappedTasks();
    console.log(`Currently swapped: ${swappedTasks.map(t => t.taskId).join(', ')}`);

    // Restore original function
    await swapManager.unswap("user.create");
  },
});
```

### Error Handling

The system provides comprehensive error handling:

```graphql
mutation {
  swapTask(taskId: "nonexistent.task", runCode: "invalid javascript code {") {
    success # false
    error # "Task 'nonexistent.task' not found" or "Compilation failed: ..."
    taskId # "nonexistent.task"
  }
}
```

### Safety and Best Practices

#### Type Safety

- No `as any` usage throughout the implementation
- Full TypeScript type checking and compilation
- Comprehensive error validation and reporting

#### Security Considerations

- Code is executed via `eval()` in the Node.js context
- Intended for development/debugging environments only
- Swapped functions have access to the same context as original functions

#### Best Practices

- Use descriptive debug messages in swapped functions
- Leverage the logging system for telemetry capture
- Test swapped functions thoroughly before deployment
- Always restore original functions after debugging

#### Error Recovery

- Failed swaps don't affect the original function
- State tracking prevents inconsistencies
- Easy rollback with `unswapAllTasks` mutation

### AI Assistant Integration

This system is specifically designed for AI debugging workflows:

1. **AI analyzes application behavior** via introspection and live telemetry
2. **AI identifies issues** in specific tasks or functions
3. **AI generates enhanced debug code** with additional logging and validation
4. **AI swaps the function remotely** via GraphQL mutations
5. **AI monitors enhanced telemetry** to understand the issue
6. **AI restores original function** once debugging is complete

### Remote Task Execution

The system provides `invokeTask` functionality for remotely executing tasks with JSON input/output serialization, perfect for AI-driven debugging and testing.

#### Basic Task Invocation

```graphql
mutation {
  invokeTask(taskId: "user.create") {
    success
    error
    taskId
    result
    executionTimeMs
    invocationId
  }
}
```

#### Task Invocation with Input

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: "{\"email\": \"test@example.com\", \"name\": \"John Doe\"}"
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### JavaScript Input Evaluation

For advanced debugging scenarios, use `evalInput: true` to evaluate JavaScript expressions instead of parsing JSON:

```graphql
mutation {
  invokeTask(
    taskId: "data.processor"
    inputJson: """
    {
      timestamp: new Date("2023-01-01"),
      data: [1, 2, 3].map(x => x * 2),
      config: {
        retries: Math.max(3, process.env.NODE_ENV === 'prod' ? 5 : 1),
        timeout: 30 * 1000
      },
      processData: (items) => items.filter(x => x > 0)
    }
    """
    evalInput: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### Pure Mode (Bypass Middleware)

Pure mode executes tasks with computed dependencies directly from the store, bypassing the middleware pipeline and authentication systems for clean testing:

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: "{\"email\": \"test@example.com\"}"
    pure: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### AI Debugging Workflow

1. **Swap task with enhanced debugging**:

```graphql
mutation {
  swapTask(
    taskId: "user.create"
    runCode: """
    async function run(input, deps) {
      console.log('Input received:', input);
      const result = { id: Math.random(), ...input };
      console.log('Result generated:', result);
      return result;
    }
    """
  ) {
    success
  }
}
```

2. **Invoke task to test behavior**:

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: """
    {
      email: "debug@test.com",
      createdAt: new Date(),
      metadata: {
        source: "ai-debug",
        sessionId: crypto.randomUUID(),
        testData: [1, 2, 3].map(x => x * 10)
      }
    }
    """
    pure: true
    # Activation of eval() for smarter inputs.
    evalInput: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

3. **Monitor live telemetry for debug output**:

```graphql
query {
  live {
    logs(last: 10) {
      level
      message
      data
      timestampMs
    }
  }
}
```

#### JSON Serialization

The system automatically handles complex JavaScript types:

- **Primitives**: strings, numbers, booleans preserved exactly
- **Objects/Arrays**: Deep serialization with proper structure
- **Functions**: Converted to `[Function: name]` strings
- **Undefined**: Converted to `[undefined]` strings
- **Dates**: Serialized as ISO strings
- **Circular References**: Safely handled to prevent errors

#### Input Processing Modes

**JSON Mode (default)**: `evalInput: false`

- Input is parsed as JSON using `JSON.parse()`
- Safe for structured data
- Limited to JSON-compatible types

**JavaScript Evaluation Mode**: `evalInput: true`

- Input is evaluated as JavaScript using `eval()`
- Supports complex expressions, function calls, Date objects, calculations
- Full access to JavaScript runtime and built-in objects
- Perfect for AI-driven testing with dynamic inputs

### Arbitrary Code Evaluation

For advanced debugging, the system provides an `eval` mutation to execute arbitrary JavaScript/TypeScript code on the server.

**⚠️ Security Warning**: This feature is powerful and executes code with the same privileges as the application. It is intended for development environments only and is disabled by default in production. To enable it, set the environment variable `RUNNER_DEV_EVAL=1`.

#### `eval` Mutation

**Execute arbitrary code:**

```graphql
mutation EvalCode($code: String!, $inputJson: String, $evalInput: Boolean) {
  eval(code: $code, inputJson: $inputJson, evalInput: $evalInput) {
    success
    error
    result # JSON string
    executionTimeMs
  }
}
```

- `code`: The JavaScript/TypeScript code to execute.
- `inputJson`: Optional input string, parsed as JSON by default.
- `evalInput`: If `true`, `inputJson` is evaluated as a JavaScript expression.

**Example:**

```graphql
mutation {
  eval(code: "return { a: 1, b: process.version }") {
    success
    result
  }
}
```

### Use Cases

- **Production Debugging**: Add logging to specific functions without restarts
- **A/B Testing**: Compare different function implementations live
- **Performance Monitoring**: Inject performance measurements
- **Error Investigation**: Add error handling and detailed logging
- **Feature Development**: Test new logic before permanent implementation
- **AI-Driven Debugging**: Enable AI assistants to debug applications autonomously

### Architecture

The hot-swapping system consists of:

- **SwapManager Resource** (`src/resources/swap.resource.ts`): Core swapping logic
- **GraphQL Types** (`src/schema/types/SwapType.ts`): Type definitions for GraphQL API
- **GraphQL Mutations** (`src/schema/mutation.ts`): Remote swap operations
- **TypeScript Compiler**: Automatic code compilation and validation
- **State Management**: Tracking of swapped functions and original code
- **Error Handling**: Comprehensive validation and recovery mechanisms

The implementation maintains 100% type safety and provides extensive test coverage with both unit tests and GraphQL integration tests.
 and GraphQL integration tests.
