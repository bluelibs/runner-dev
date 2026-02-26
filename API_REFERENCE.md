# GraphQL API Reference

This document provides a detailed overview of the `@bluelibs/runner-dev` GraphQL API.

## API Highlights

All arrays are non-null lists with non-null items, and ids are complemented by resolved fields for deep traversal.

## Runner 6.0 Migration Notes

| Before | After (hard switch) |
| --- | --- |
| `Resource.exports` | `Resource.isolation { deny, only, exports, exportsMode }` |
| `Middleware.global` | `Middleware.autoApply { enabled, scope, hasPredicate }` |
| `Tag.middlewares` | `Tag.taskMiddlewares` + `Tag.resourceMiddlewares` |
| N/A | `Tag.errors`, `Tag.targets` |
| `RunOptions.initMode` | `RunOptions.lifecycleMode` |

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
- `runOptions: RunOptions!` — effective run options summary (mode, debug/logs, lifecycle, root)
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
- `isolation { deny, only, exports, exportsMode }`
- `subtree { tasks/resources/hooks/taskMiddleware/resourceMiddleware/events/tags }`
- `cooldown: Boolean!`
- `usedBy: [Task!]!`
- `emits: [Event!]!` (inferred from task/hook emissions)
- `dependsOn: [String!]!`, `dependsOnResolved: [Resource!]!`
- `registeredBy: String`, `registeredByResolved: Resource`
- `tags: [Tag!]!`

#### Events

- `emittedBy: [String!]!`, `emittedByResolved: [BaseElement!]!`
- `listenedToBy: [String!]!`, `listenedToByResolved: [Hook!]!`
- `payloadSchema: String`, `payloadSchemaReadable: String`
- `transactional: Boolean!`, `parallel: Boolean!`
- `eventLane { laneId, orderingKey, metadata }`
- `registeredBy: String`, `registeredByResolved: Resource`
- `tags: [Tag!]!`

#### TaskMiddleware

- `autoApply: MiddlewareAutoApply`
- `usedBy: [Task!]!`, `usedByDetailed: [MiddlewareTaskUsage!]!`
- `emits: [Event!]!`
- `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
- `configSchema: String`, `configSchemaReadable: String`
- `tags: [Tag!]!`

#### ResourceMiddleware

- `autoApply: MiddlewareAutoApply`
- `usedBy: [Resource!]!`, `usedByDetailed: [MiddlewareResourceUsage!]!`
- `emits: [Event!]!`
- `overriddenBy: String`, `registeredBy: String`, `registeredByResolved: Resource`
- `configSchema: String`, `configSchemaReadable: String`
- `tags: [Tag!]!`

#### RunOptions

- `mode: String!` — the runner mode ("dev", "test", or "prod")
- `debug: Boolean!` — whether debug resource was enabled at startup
- `debugMode: String` — high-level debug mode summary (`normal`, `verbose`, `custom`, `disabled`)
- `logsEnabled: Boolean!` — whether logs are printed (false when threshold is null)
- `logsPrintThreshold: String` — effective log print threshold or null
- `logsPrintStrategy: String` — effective log print strategy or null
- `logsBuffer: Boolean!` — whether logging is buffered
- `errorBoundary: Boolean` — process-level error boundary setting (null when unknown)
- `shutdownHooks: Boolean` — SIGINT/SIGTERM shutdown hooks setting (null when unknown)
- `dryRun: Boolean!` — whether runtime started in dry-run mode
- `lazy: Boolean!` — whether lazy resource mode is enabled
- `lifecycleMode: String!` — startup init strategy (`sequential` or `parallel`)
- `disposeBudgetMs: Float` - total shutdown disposal budget in milliseconds
- `disposeDrainBudgetMs: Float` - shutdown drain wait budget in milliseconds
- `runtimeEventCycleDetection: Boolean` — runtime event-cycle detection setting (null when unknown)
- `hasOnUnhandledError: Boolean!` — whether an `onUnhandledError` callback is present
- `rootId: String!` — the id of the root resource passed to run()

#### Lifecycle Events

- `globals.events.disposing`
- `globals.events.drained`

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
- Runner 6 errors to track: `runner.errors.subtreeValidationFailed`, `runner.errors.shutdownLockdown`, `runner.errors.runtimeAccessViolation`, `runner.errors.eventLanes.queueNotInitialized`, `runner.errors.eventLanes.profileNotFound`, `runner.errors.eventLanes.bindingNotFound`, `runner.errors.eventLanes.eventNotRegistered`, `runner.errors.eventLanes.messageMalformed`.

### System Health

- **memory: `MemoryStats!`**
  - Fields: `heapUsed` (bytes), `heapTotal` (bytes), `rss` (bytes)
- **cpu: `CpuStats!`**
  - Fields: `usage` (0..1 event loop utilization), `loadAverage` (1‑minute load avg)
- **eventLoop(reset: Boolean): `EventLoopStats!`**
  - Fields: `lag` (ms, avg delay via `monitorEventLoopDelay`)
- **gc(windowMs: Float): `GcStats!`**
  - Fields: `collections` (count), `duration` (ms)

