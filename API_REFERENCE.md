# GraphQL API Reference

This document provides a detailed overview of the `@bluelibs/runner-dev` GraphQL API.

## API Highlights

All arrays are non-null lists with non-null items, and ids are complemented by resolved fields for deep traversal.

### Common Types

- `BaseElement`: `id: ID!`, `meta: Meta`, `filePath: String`, `markdownDescription: String!`, `fileContents(startLine: Int, endLine: Int): String`
- `Meta`: `title: String`, `description: String`, `tags: [MetaTagUsage!]!`
- `MetaTagUsage`: `id: ID!`, `config: String`

### Query Root

- `all(idIncludes: ID): [BaseElement!]!`
- `event(id: ID!): Event`, `events(filter: EventFilterInput): [Event!]!`
- `task(id: ID!): Task`, `tasks(idIncludes: ID): [Task!]!`
- `hooks(idIncludes: ID): [Hook!]!`
- `middleware(id: ID!): Middleware`, `middlewares(idIncludes: ID): [Middleware!]!`
- `taskMiddlewares(idIncludes: ID): [TaskMiddleware!]!`
- `resourceMiddlewares(idIncludes: ID): [ResourceMiddleware!]!`
- `resource(id: ID!): Resource`, `resources(idIncludes: ID): [Resource!]!`
- `root: Resource`
- `runOptions: RunOptions!` — effective run options (mode, debug, rootId)
- `swappedTasks: [SwappedTask!]!`
- `live: Live!`
- `diagnostics: [Diagnostic!]!`
- `tag(id: ID!): Tag`
- `tags: [Tag!]!`

### Detailed Types

#### All Elements

- `id`, `meta`, `filePath`, `fileContents`, `markdownDescription`, `tags: [Tag!]!`

#### Tasks & Hooks

- Shared: `emits: [String!]!`, `emitsResolved: [Event!]!`, `runs: [RunRecord!]!`, `tags: [Tag!]!`
- Shared: `dependsOn: [String!]!`
- Shared: `middleware: [String!]!`, `middlewareResolved: [TaskMiddleware!]!`, `middlewareResolvedDetailed: [TaskMiddlewareUsage!]!`
- Shared: `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
- Task-specific: `inputSchema: String`, `inputSchemaReadable: String`, `dependsOnResolved { tasks { id } hooks { id } resources { id } emitters { id } }`
- Hook-specific: `event: String!`, `hookOrder: Int`, `inputSchema: String`, `inputSchemaReadable: String`

#### Resources

- `config: String`, `context: String`, `configSchema: String`, `configSchemaReadable: String`
- `middleware`, `middlewareResolved: [ResourceMiddleware!]!`, `middlewareResolvedDetailed: [TaskMiddlewareUsage!]!`
- `overrides`, `overridesResolved`
- `registers`, `registersResolved`
- `usedBy: [Task!]!`
- `emits: [Event!]!` (inferred from task/hook emissions)
- `dependsOn: [String!]!`, `dependsOnResolved: [Resource!]!`
- `registeredBy: String`, `registeredByResolved: Resource`
- `tags: [Tag!]!`

#### Events

- `emittedBy: [String!]!`, `emittedByResolved: [BaseElement!]!`
- `listenedToBy: [String!]!`, `listenedToByResolved: [Hook!]!`
- `payloadSchema: String`, `payloadSchemaReadable: String`
- `registeredBy: String`, `registeredByResolved: Resource`
- `tags: [Tag!]!`

#### TaskMiddleware

- `global: GlobalMiddleware`
- `usedBy: [Task!]!`, `usedByDetailed: [MiddlewareTaskUsage!]!`
- `emits: [Event!]!`
- `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
- `configSchema: String`, `configSchemaReadable: String`
- `tags: [Tag!]!`

#### ResourceMiddleware

- `global: GlobalMiddleware`
- `usedBy: [Resource!]!`, `usedByDetailed: [MiddlewareResourceUsage!]!`
- `emits: [Event!]!`
- `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
- `configSchema: String`, `configSchemaReadable: String`
- `tags: [Tag!]!`

#### RunOptions

- `mode: String!` — the runner mode ("dev", "test", or "prod")
- `debug: Boolean!` — whether debug resource was enabled at startup
- `rootId: String!` — the id of the root resource passed to run()

### Live Telemetry

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

**Enums:**

- `LogLevelEnum`: `trace | debug | info | warn | error | fatal | log`
- `SourceKindEnum`: `TASK | HOOK | RESOURCE | MIDDLEWARE | INTERNAL`
- `NodeKindEnum`: `TASK | HOOK`

### Diagnostics

- `Diagnostic { severity: String!, code: String!, message: String!, nodeId: ID, nodeKind: String }`
- Example codes: `ORPHAN_EVENT`, `UNEMITTED_EVENT`, `UNUSED_MIDDLEWARE`, `MISSING_FILE`, `OVERRIDE_CONFLICT`.

### System Health

- **memory: `MemoryStats!`**
  - Fields: `heapUsed` (bytes), `heapTotal` (bytes), `rss` (bytes)
- **cpu: `CpuStats!`**
  - Fields: `usage` (0..1 event loop utilization), `loadAverage` (1‑minute load avg)
- **eventLoop(reset: Boolean): `EventLoopStats!`**
  - Fields: `lag` (ms, avg delay via `monitorEventLoopDelay`)
- **gc(windowMs: Float): `GcStats!`**
  - Fields: `collections` (count), `duration` (ms)
