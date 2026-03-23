# GraphQL API Reference

This document tracks the current `@bluelibs/runner-dev` GraphQL surface.
It has been refreshed for the current SDL and focuses on the entry points people actually reach for first: root queries, mutations, live telemetry, and the higher-signal topology types.

If you need the complete schema SDL instead of the guided summary below, print it directly from the current build:

```bash
# Against a running app
runner-dev schema sdl --endpoint http://localhost:1337/graphql

# Or in dry-run mode from a local entry file
runner-dev schema sdl --entry-file src/main.ts
```

## Highlights

- Introspection spans tasks, hooks, resources, events, tags, errors, async contexts, middleware, run options, and interceptor ownership.
- Resource docs now include `isolation`, `subtree`, cooldown/ready/health flags, and resolved registrations.
- Task docs include durable workflow metadata, RPC lane summary, and runtime interceptor ownership.
- Live telemetry includes logs, event emissions, errors, runs, process stats, and per-resource health reports.
- Mutations cover task swapping, unswapping, task/event invocation, file editing, and guarded eval.

## Query Root

The current `Query` type exposes:

- `root: Resource`
- `runOptions: RunOptions!`
- `interceptorOwners: InterceptorOwnersSnapshot!`
- `all(idIncludes: ID): [BaseElement!]!`
- `tags: [Tag!]!`
- `tag(id: ID!): Tag`
- `task(id: ID!): Task`
- `tasks(idIncludes: ID): [Task!]!`
- `hook(id: ID!): Hook`
- `hooks(idIncludes: ID): [Hook!]!`
- `resource(id: ID!): Resource`
- `resources(idIncludes: ID): [Resource!]!`
- `event(id: ID!): Event`
- `events(filter: EventFilterInput): [Event!]!`
- `middleware(id: ID!): Middleware`
- `middlewares(idIncludes: ID): [Middleware!]!`
- `taskMiddlewares(idIncludes: ID): [TaskMiddleware!]!`
- `resourceMiddlewares(idIncludes: ID): [ResourceMiddleware!]!`
- `error(id: ID!): Error`
- `errors(idIncludes: ID): [Error!]!`
- `asyncContext(id: ID!): AsyncContext`
- `asyncContexts(idIncludes: ID): [AsyncContext!]!`
- `live: Live!`
- `diagnostics: [Diagnostic!]!`
- `swappedTasks: [SwappedTask!]!`

### Common Query Filters

- `EventFilterInput`
  - `hasNoHooks: Boolean`
  - `hideSystem: Boolean`
  - `idIncludes: String`
- `RunFilterInput`
  - `nodeKinds`, `nodeIds`, `ok`, `parentIds`, `rootIds`, `correlationIds`
- `LogFilterInput`
  - `levels`, `messageIncludes`, `correlationIds`
- `EmissionFilterInput`
  - `eventIds`, `emitterIds`, `correlationIds`
- `ErrorFilterInput`
  - `sourceKinds`, `sourceIds`, `messageIncludes`, `correlationIds`

## Mutation Root

The current `Mutation` type exposes:

- `swapTask(taskId: ID!, runCode: String!): SwapResult!`
- `unswapTask(taskId: ID!): SwapResult!`
- `unswapAllTasks: [SwapResult!]!`
- `invokeTask(taskId: ID!, inputJson: String, pure: Boolean = false, evalInput: Boolean = false): InvokeResult!`
- `invokeEvent(eventId: ID!, inputJson: String, evalInput: Boolean = false): InvokeEventResult!`
- `editFile(path: String!, content: String!): EditFileResult!`
- `eval(code: String!): EvalResult!`

### Mutation Notes

- `swapTask` replaces a task's `run()` implementation at runtime.
- `invokeTask` supports `pure: true` to bypass middleware.
- `editFile` accepts structured paths such as `workspace:src/index.ts`.
- `eval` is guarded and disabled in production unless `RUNNER_DEV_EVAL=1`.

## Core Types

### BaseElement

Shared across tasks, hooks, resources, middleware, events, tags, errors, and async contexts:

- `id`
- `meta`
- `filePath`
- `fileContents(startLine, endLine)`
- `markdownDescription`
- `isPrivate`
- `visibilityReason`
- `tags`
- `tagsDetailed`

Many concrete element types also expose:

- `coverage`
- `coverageContents`
- `registeredBy`
- resolved variants such as `registeredByResolved`

### Task

Key fields:

- `dependsOn`, `dependsOnResolved`
- `middleware`, `middlewareResolved`, `middlewareResolvedDetailed`
- `emits`, `emitsResolved`
- `inputSchema`, `inputSchemaReadable`
- `rpcLane`
- `interceptorCount`, `hasInterceptors`, `interceptorOwnerIds`
- `runs(afterTimestamp, last, filter)`
- `isDurable`, `durableResource`
- `overriddenBy`, `registeredBy`

The middleware usage objects now include subtree provenance details:

- `TaskMiddlewareUsage.id`
- `TaskMiddlewareUsage.config`
- `TaskMiddlewareUsage.origin`
- `TaskMiddlewareUsage.subtreeOwnerId`
- `TaskMiddlewareUsage.node`

### Hook

Key fields:

- `events`
- `event` (deprecated singular form)
- `hookOrder`
- `dependsOn`, `depenendsOnResolved`
- `middleware`, `middlewareResolvedDetailed`
- `runs(...)`

### Resource

Key fields:

- `dependsOn`, `dependsOnResolved`
- `config`, `configSchema`, `configSchemaReadable`
- `context`
- `middleware`, `middlewareResolvedDetailed`
- `overrides`, `overridesResolved`
- `registers`, `registersResolved`
- `usedBy`
- `emits`
- `registeredBy`, `registeredByResolved`
- `hasCooldown`, `hasReady`, `hasHealthCheck`
- `isolation`
- `subtree`

Important nested resource types:

- `ResourceIsolation`
  - `deny`
  - `only`
  - `whitelist`
  - `exports`
  - `exportsMode`
- `ResourceSubtreePolicy`
  - `tasks`
  - `middleware`
  - `resources`
  - `hooks`
  - `taskMiddleware`
  - `resourceMiddleware`
  - `events`
  - `tags`

Subtree policy now covers identity-aware summaries too:

- `ResourceSubtreeTaskBranch.identity`
- `ResourceSubtreeMiddlewareScope.identityScope`

### Middleware

The generic `Middleware` type exposes the combined view used by the introspector:

- `autoApply`
- `emits`
- `configSchema`, `configSchemaReadable`
- `usedByTasks`, `usedByTasksResolved`, `usedByTasksDetailed`
- `usedByResources`, `usedByResourcesResolved`, `usedByResourcesDetailed`

Specialized views:

- `TaskMiddleware.usedBy`
- `TaskMiddleware.usedByDetailed`
- `ResourceMiddleware.usedBy`
- `ResourceMiddleware.usedByDetailed`

### Event

Key fields:

- `payloadSchema`, `payloadSchemaReadable`
- `transactional`
- `parallel`
- `eventLane`
- `rpcLane`
- `emittedBy`, `emittedByResolved`
- `listenedToBy`, `listenedToByResolved`
- `registeredBy`, `registeredByResolved`

### Tag

Tags now fan out across the full model:

- `configSchema`
- `config`
- `targets`
- `tasks`
- `hooks`
- `resources`
- `taskMiddlewares`
- `resourceMiddlewares`
- `events`
- `errors`
- `all`

### Error

Key fields:

- `dataSchema`
- `thrownBy`

### AsyncContext

Key fields:

- `serialize`
- `parse`
- `usedBy`
- `requiredBy`
- `providedBy`

### RunOptions

Runner-dev now exposes effective startup/runtime settings through `runOptions`:

- `mode`
- `debug`, `debugMode`
- `logsEnabled`, `logsPrintThreshold`, `logsPrintStrategy`, `logsBuffer`
- `errorBoundary`
- `shutdownHooks`
- `dryRun`
- `lazy`
- `lifecycleMode`
- `dispose`
- `executionContext`
- `hasOnUnhandledError`
- `rootId`

Nested types:

- `RunDisposeOptions`
  - `totalBudgetMs`
  - `drainingBudgetMs`
  - `cooldownWindowMs`
- `RunExecutionContextOptions`
  - `enabled`
  - `cycleDetection`

### InterceptorOwnersSnapshot

Useful when debugging `taskDependency.intercept(...)` and middleware interceptors:

- `tasksById`
- `middleware.globalTaskInterceptorOwnerIds`
- `middleware.globalResourceInterceptorOwnerIds`
- `middleware.perTaskMiddlewareInterceptorOwnerIds`
- `middleware.perResourceMiddlewareInterceptorOwnerIds`

## Live Telemetry

`live: Live!` exposes:

- `memory: MemoryStats!`
- `cpu: CpuStats!`
- `eventLoop(reset: Boolean): EventLoopStats!`
- `gc(windowMs: Float): GcStats!`
- `logs(afterTimestamp, last, filter): [LogEntry!]!`
- `emissions(afterTimestamp, last, filter): [EmissionEntry!]!`
- `errors(afterTimestamp, last, filter): [ErrorEntry!]!`
- `runs(afterTimestamp, last, filter): [RunRecord!]!`
- `healthReport: ResourceHealthReport`

Supporting types include:

- `LogEntry`
- `EmissionEntry`
- `ErrorEntry`
- `RunRecord`
- `ResourceHealthReport`
- `ResourceHealthTotals`
- `ResourceHealthEntry`

## Diagnostics And Swap Types

- `Diagnostic`
  - `severity`
  - `code`
  - `message`
  - `nodeId`
  - `nodeKind`
- `SwapResult`
- `SwappedTask`
- `InvokeResult`
- `InvokeEventResult`
- `EvalResult`
- `EditFileResult`

## Enums Worth Knowing

- `LogLevelEnum`
  - `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `log`
- `SourceKindEnum`
  - `TASK`, `HOOK`, `RESOURCE`, `MIDDLEWARE`, `INTERNAL`
- `NodeKindEnum`
  - `TASK`, `HOOK`
- `MiddlewareApplyScope`
  - `WHERE_VISIBLE`, `SUBTREE`
- `IsolationExportsMode`
  - `UNSET`, `NONE`, `LIST`
- `TagTarget`
  - `TASKS`, `RESOURCES`, `EVENTS`, `HOOKS`, `TASK_MIDDLEWARES`, `RESOURCE_MIDDLEWARES`, `ERRORS`
- `ResourceHealthStatus`
  - `healthy`, `degraded`, `unhealthy`

## SDL Regeneration

When this file drifts, regenerate your view from the actual schema rather than hand-guessing:

```bash
runner-dev schema sdl --endpoint http://localhost:1337/graphql
```

Or from the repo without a running server:

```bash
runner-dev schema sdl --entry-file src/main.ts
```
