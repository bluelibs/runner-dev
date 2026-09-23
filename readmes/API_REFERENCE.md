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
- Boundary queries expose declared exports, effective exports through exported resources, and private definitions.
- Task docs include durable workflow metadata, RPC lane summary, and runtime interceptor ownership.
- Live telemetry includes logs, event emissions, errors, runs, process stats, and per-resource health reports. Every entry carries a store-wide `sequence` cursor for lossless paging.
- Task and resource middleware usages carry subtree provenance (`origin`, `subtreeOwnerId`).
- Mutations cover task swapping, unswapping, task/event invocation, file editing, guarded eval, and the runtime shell. Everything that runs code or writes files sits behind one code-execution gate.

## Transport And Access

The `dev` resource serves, on port 1337 by default:

- `POST /graphql` — the API described here
- `GET /live/stream` — Server-Sent Events: `telemetry` (`{ logs, emissions, errors, runs }` deltas, each entry with its `sequence`) and `health` events, plus a `: heartbeat` comment every 15s; the server ends open streams when it shuts down
- `GET /docs` — the docs UI; `GET /docs/data` — its JSON payload
- `GET /voyager` — GraphQL Voyager; `GET /` redirects there

Access rules:

- Without a `host` option the server listens on `127.0.0.1`.
- On every bind, any request whose `Host` header is a DNS name other than `localhost`, the configured `host` or an `allowedHosts` entry (or that has no Host header) gets `403` with `{ "errors": [{ "message": "Forbidden: this runner-dev server only answers requests addressed to localhost, an IP address or a name in allowedHosts ..." }] }`. IP addresses always pass. This guards against DNS rebinding and covers every route.
- `dev.with({ host: "0.0.0.0" })` (or `resources.server.with({ host })`) exposes the server on the network; add `allowedHosts: ["devbox.lan"]` to reach it by a DNS name. There is no authentication; when the bound address is not loopback and the code-execution gate is also open, the server logs a warning at startup.
- The served docs UI calls this API on the origin it was loaded from; set the `API_URL` environment variable on the server to point it elsewhere.
- The code-execution gate (see Mutation Notes) is open only with `RUNNER_DEV_EVAL=1` or `NODE_ENV` exactly `development` or `test`.

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
- `boundary(ownerId: ID!): ResourceBoundary`
- `boundaries(ownerIdIncludes: ID): [ResourceBoundary!]!`
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
- `codeExecutionEnabled: Boolean!`
- `shellEnabled: Boolean!`
- `shellComplete(code: String!, position: Int!, resourceId: ID): ShellCompletion!`

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
- `shell(code: String!, resourceId: ID): ShellResult!`

### Mutation Notes

- `swapTask` replaces a task's `run()` implementation at runtime.
- `invokeTask` supports `pure: true` to bypass middleware. `invokeTask`/`invokeEvent` with plain JSON `inputJson` are not gated; `evalInput: true` evaluates `inputJson` as JavaScript and is.
- Code-execution gate: `eval`, `shell`, `shellComplete`, `swapTask`, `editFile`, and `invokeTask`/`invokeEvent` with `evalInput: true` run only with `RUNNER_DEV_EVAL=1` or `NODE_ENV` exactly `development`/`test` (closed when `NODE_ENV` is unset). When closed they return `success: false` with `<Feature> is disabled in this environment. Set RUNNER_DEV_EVAL=1 or NODE_ENV=development on the server to enable it.` (`shellComplete` returns no options). `codeExecutionEnabled` reports the gate; `shellEnabled` is the same value.
- `editFile` accepts structured paths such as `workspace:src/index.ts`. It is gated because a written source file runs as soon as a watcher reloads it.
- `eval` and `shell` runs are bounded by `RUNNER_DEV_SHELL_TIMEOUT_MS` (default 30000; a whole number from 1 to 2147483647, anything else fails the run before code executes). A timed-out run returns `success: false` with `<Shell|Eval> execution timed out after N ms. The code may still be running …`, since JavaScript cannot cancel it. Results are cut past 256 KB with `… [truncated N chars]`, and `shell` keeps at most 200 captured console lines / 20000 characters.
- `swapTask`, `eval` and `shell` compile code with `typescript`, an optional peer dependency (5 or 6). Without it they fail with `Install typescript 5 or 6 to use swapTask, eval and shell: ...`.
- `shell` runs REPL-style snippets with `r` (resource value) and `runtime` in scope and captures `console` into `logs`.
- `shellComplete` lists member completions for a snippet at a cursor offset by walking the live shell scope (side-effect free); the shell editor uses it for as-you-type autocomplete.

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
- `runs(afterTimestamp, afterSequence, last, filter)` (same cursor semantics as the live lists)
- `isDurable`, `durableResource`, `durableWorkflowKey`
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
- `runs(afterTimestamp, afterSequence, last, filter)`

### Resource

Key fields:

- `dependsOn`, `dependsOnResolved`
- `config`, `configSchema`, `configSchemaReadable`
- `context`
- `middleware`, `middlewareResolvedDetailed` (`[ResourceMiddlewareUsage!]!`)
- `overrides`, `overridesResolved`
- `registers`, `registersResolved`
- `usedBy`
- `emits`
- `registeredBy`, `registeredByResolved`
- `hasCooldown`, `hasReady`, `hasHealthCheck`
- `isolation`
- `subtree`
- `surface`

`ResourceMiddlewareUsage` mirrors `TaskMiddlewareUsage`:

- `id`, `config`, `node`
- `origin` — `"local"` or `"subtree"`
- `subtreeOwnerId` — the resource whose `subtree({ resources: { middleware } })` policy applied it. An owner's own subtree resource middleware also applies to the owner, so it appears on the owner with `origin: "subtree"` and the owner's id here.

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

### ResourceBoundary

Key fields:

- `ownerId`
- `exportsDeclared`
- `declaredExports`
- `effectiveExports`
- `privateDefinitions`

`declaredExports` mirrors the direct `.isolate({ exports })` list. `effectiveExports` also includes definitions reachable through an exported resource's own public surface. `privateDefinitions` lists registered definitions inside the boundary that are not visible outside it.

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

`emits` lists the events emitted by the nodes the middleware wraps: tasks and hooks for task middleware, the wrapped resources' own emits for resource middleware. Tasks and hooks that only depend on a wrapped resource are not included. (The docs UI topology lenses draw a middleware's `emits` edges from the middleware's own event dependencies instead.)

The detailed usage types (`MiddlewareTaskUsage`, `MiddlewareResourceUsage`) expose `id`, `config`, `origin`, `subtreeOwnerId` and `node`, the same provenance as the task and resource usage types.

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
- `logs(afterTimestamp, afterSequence, last, filter): [LogEntry!]!`
- `emissions(afterTimestamp, afterSequence, last, filter): [EmissionEntry!]!`
- `errors(afterTimestamp, afterSequence, last, filter): [ErrorEntry!]!`
- `runs(afterTimestamp, afterSequence, last, filter): [RunRecord!]!`
- `healthReport: ResourceHealthReport`

Cursor arguments (shared by the four lists and by `Task.runs` / `Hook.runs`):

- `afterSequence: Float` — exclusive; only entries whose `sequence` is greater. Pass the last received entry's `sequence` to page forward without gaps.
- `afterTimestamp: Float` — exclusive, milliseconds since epoch. Entries sharing one millisecond can straddle a page cut, so prefer `afterSequence` when every entry matters.
- `last: Int` — with a cursor, the oldest N entries after it (page forward); without a cursor, the most recent N. Results are always oldest first.

Every entry type (`LogEntry`, `EmissionEntry`, `ErrorEntry`, `RunRecord`) has `sequence: Float!`: strictly increasing across all four categories and never reused. It is an ordering key, not a count; values are seeded from the wall clock so they keep increasing across restarts.

Supporting types include:

- `LogEntry` — `sequence`, `timestampMs`, `level`, `message`, `data`, `correlationId`, `sourceId`
- `EmissionEntry` — `sequence`, `timestampMs`, `eventId`, `emitterId`, `payload`, `correlationId`, resolved variants
- `ErrorEntry` — `sequence`, `timestampMs`, `sourceId`, `sourceKind`, `message`, `stack`, `data`, `correlationId`, `sourceResolved`
- `RunRecord` — `sequence`, `timestampMs`, `nodeId`, `nodeKind`, `durationMs`, `ok`, `error`, `parentId`, `rootId`, `correlationId`, `nodeResolved`
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
- `EvalResult` — `success`, `error`, `result` (JSON string), `executionTimeMs`, `invocationId`
- `EditFileResult` — `success`, `error`, `path`, `resolvedPath`
- `ShellResult` — `success`, `error`, `result`, `logs` (captured console lines), `executionTimeMs`, `invocationId`
- `ShellCompletion` — `from` (offset the completed word starts at), `options: [ShellCompletionOption!]!` with `label`, `type`, `detail`

## Enums Worth Knowing

- `LogLevelEnum`
  - `trace`, `debug`, `info`, `warn`, `error`, `critical`, `fatal`, `log` (Runner's logger emits `trace` through `critical`; `fatal` and `log` only come from direct `Live.recordLog` calls)
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
