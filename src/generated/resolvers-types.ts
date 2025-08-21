import { GraphQLResolveInfo } from 'graphql';
import { CustomGraphQLContext } from '../schema/context';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

/** Minimal, generic element used for root and as a fallback when a specific concrete type cannot be resolved. */
export type All = BaseElement & {
  __typename?: 'All';
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to element file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Element ID */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Element metadata */
  meta: Maybe<Meta>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
};


/** Minimal, generic element used for root and as a fallback when a specific concrete type cannot be resolved. */
export type AllFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

/** Common fields for all runner elements */
export type BaseElement = {
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Source file path when available */
  filePath: Maybe<Scalars['String']['output']>;
  /** Stable identifier */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Optional metadata (title, description, tags) */
  meta: Maybe<Meta>;
};


/** Common fields for all runner elements */
export type BaseElementFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type CpuStats = {
  __typename?: 'CpuStats';
  /** System 1-minute load average */
  loadAverage: Scalars['Float']['output'];
  /** Event loop utilization ratio (0..1) since last sample or process start */
  usage: Scalars['Float']['output'];
};

export type Diagnostic = {
  __typename?: 'Diagnostic';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  nodeId: Maybe<Scalars['ID']['output']>;
  nodeKind: Maybe<Scalars['String']['output']>;
  severity: Scalars['String']['output'];
};

export type EmissionEntry = {
  __typename?: 'EmissionEntry';
  /** Correlation id for tracing */
  correlationId: Maybe<Scalars['String']['output']>;
  /** Emitter id when available */
  emitterId: Maybe<Scalars['String']['output']>;
  /** Resolved emitter node (task/hook/resource/middleware) if known; otherwise returns a minimal All node */
  emitterResolved: Maybe<BaseElement>;
  /** Emitted event id */
  eventId: Scalars['String']['output'];
  /** Resolved event from eventId */
  eventResolved: Maybe<Event>;
  /** Stringified JSON if object */
  payload: Maybe<Scalars['String']['output']>;
  /** Emission time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Filters for event emissions */
export type EmissionFilterInput = {
  /** Filter by correlation ids */
  correlationIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific emitter ids */
  emitterIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific event ids */
  eventIds: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ErrorEntry = {
  __typename?: 'ErrorEntry';
  /** Correlation id for tracing */
  correlationId: Maybe<Scalars['String']['output']>;
  /** Stringified JSON if object */
  data: Maybe<Scalars['String']['output']>;
  /** Error message */
  message: Scalars['String']['output'];
  /** Id of the source that emitted the error */
  sourceId: Scalars['ID']['output'];
  /** Kind of source (task/hook/resource/middleware/internal) */
  sourceKind: SourceKindEnum;
  /** Resolved source node (task/hook/resource/middleware), else minimal All */
  sourceResolved: Maybe<BaseElement>;
  /** Error stack when available */
  stack: Maybe<Scalars['String']['output']>;
  /** Error time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Filters for captured errors */
export type ErrorFilterInput = {
  /** Filter by correlation ids */
  correlationIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Substring match inside error message */
  messageIncludes: InputMaybe<Scalars['String']['input']>;
  /** Only include errors from specific source ids */
  sourceIds: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Only include errors from specific source kinds */
  sourceKinds: InputMaybe<Array<SourceKindEnum>>;
};

export type Event = BaseElement & {
  __typename?: 'Event';
  /** Ids of task/hook/resource nodes that emit this event */
  emittedBy: Array<Scalars['String']['output']>;
  /** Nodes that emit this event (resolved). Can be Task, Hook or Resource. */
  emittedByResolved: Array<BaseElement>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to event file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Event id */
  id: Scalars['ID']['output'];
  /** Ids of task/hook nodes listening to this event */
  listenedToBy: Array<Scalars['String']['output']>;
  /** Task/hook nodes listening to this event (resolved) */
  listenedToByResolved: Array<Hook>;
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Event metadata */
  meta: Maybe<Meta>;
  /** Prettified Zod JSON structure for the event payload schema, if provided */
  payloadSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the event payload schema, if provided */
  payloadSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this event (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this event (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
};


export type EventFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

/** Filters for events in the system */
export type EventFilterInput = {
  /** When true, only events without hooks are returned. */
  hasNoHooks: InputMaybe<Scalars['Boolean']['input']>;
  /** When true, hides internal/system events (runner-dev/globals). */
  hideSystem: InputMaybe<Scalars['Boolean']['input']>;
  /** Return only events whose id contains this substring. */
  idIncludes: InputMaybe<Scalars['String']['input']>;
};

export type EventLoopStats = {
  __typename?: 'EventLoopStats';
  /** Average event loop delay (ms) measured via monitorEventLoopDelay */
  lag: Scalars['Float']['output'];
};

export type GcStats = {
  __typename?: 'GcStats';
  /** Number of GC cycles since process start */
  collections: Scalars['Int']['output'];
  /** Total time spent in GC (ms) since process start */
  duration: Scalars['Float']['output'];
};

export type GlobalMiddleware = {
  __typename?: 'GlobalMiddleware';
  /** Whether the middleware is active globally */
  enabled: Scalars['Boolean']['output'];
  /** Globally enabled for resources */
  resources: Scalars['Boolean']['output'];
  /** Globally enabled for tasks */
  tasks: Scalars['Boolean']['output'];
};

export type Hook = BaseElement & {
  __typename?: 'Hook';
  /** Ids of resources/tasks this hook depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Flattened dependencies resolved to All (tasks, hooks, resources) */
  depenendsOnResolved: Array<BaseElement>;
  /** Event ids this hook may emit (from dependencies) */
  emits: Array<Scalars['String']['output']>;
  /** Events emitted by this hook (resolved) */
  emitsResolved: Array<Event>;
  /** The event id this hook listens to */
  event: Scalars['String']['output'];
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to hook file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Execution order among hooks for the same event */
  hookOrder: Maybe<Scalars['Int']['output']>;
  /** Hook id */
  id: Scalars['ID']['output'];
  /** Prettified Zod JSON structure for the input schema, if provided */
  inputSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the input schema, if provided */
  inputSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Hook metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this hook */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this hook (resolved) */
  middlewareResolved: Array<TaskMiddleware>;
  /** Middlewares applied to this hook with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Id of the resource that overrides this hook (if any). Overriding replaces registrations at runtime. */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this hook (if any). Useful to trace provenance. */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this hook (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Execution run records for this hook */
  runs: Array<RunRecord>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
};


export type HookFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};


export type HookRunsArgs = {
  afterTimestamp: InputMaybe<Scalars['Int']['input']>;
  filter: InputMaybe<RunFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};

/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type Live = {
  __typename?: 'Live';
  /** CPU-related statistics */
  cpu: CpuStats;
  /** Event emissions with optional timestamp cursor, filters and last N */
  emissions: Array<EmissionEntry>;
  /** Errors captured with optional timestamp cursor, filters and last N */
  errors: Array<ErrorEntry>;
  /** Event loop statistics */
  eventLoop: EventLoopStats;
  /** Garbage collector statistics. By default totals since process start; when windowMs provided, returns stats within that window. */
  gc: GcStats;
  /** Live logs with optional timestamp cursor, filters and last N */
  logs: Array<LogEntry>;
  /** Process memory usage */
  memory: MemoryStats;
  /** Execution run records with optional timestamp cursor, filters and last N */
  runs: Array<RunRecord>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveEmissionsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<EmissionFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveErrorsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<ErrorFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveEventLoopArgs = {
  reset: InputMaybe<Scalars['Boolean']['input']>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveGcArgs = {
  windowMs: InputMaybe<Scalars['Float']['input']>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveLogsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<LogFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


/** Real-time telemetry access: logs, event emissions, errors, runs, and system health. */
export type LiveRunsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<RunFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};

export type LogEntry = {
  __typename?: 'LogEntry';
  /** Correlation id for tracing */
  correlationId: Maybe<Scalars['String']['output']>;
  /** Stringified JSON if object */
  data: Maybe<Scalars['String']['output']>;
  /** Log level */
  level: LogLevelEnum;
  /** Log message */
  message: Scalars['String']['output'];
  /** Log creation time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Filters for logs */
export type LogFilterInput = {
  /** Filter by correlation ids */
  correlationIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific levels */
  levels: InputMaybe<Array<LogLevelEnum>>;
  /** Substring match inside message */
  messageIncludes: InputMaybe<Scalars['String']['input']>;
};

/** Supported log levels */
export type LogLevelEnum =
  | 'debug'
  | 'error'
  | 'fatal'
  | 'info'
  | 'log'
  | 'trace'
  | 'warn';

export type MemoryStats = {
  __typename?: 'MemoryStats';
  /** V8 heap total in bytes */
  heapTotal: Scalars['Float']['output'];
  /** V8 heap used in bytes */
  heapUsed: Scalars['Float']['output'];
  /** Resident Set Size in bytes */
  rss: Scalars['Float']['output'];
};

export type Meta = {
  __typename?: 'Meta';
  /** Longer description */
  description: Maybe<Scalars['String']['output']>;
  /** Tags attached to the element with optional serialized config */
  tags: Array<MetaTagUsage>;
  /** Human-readable title */
  title: Maybe<Scalars['String']['output']>;
};

export type MetaTagUsage = {
  __typename?: 'MetaTagUsage';
  config: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
};

export type Middleware = BaseElement & {
  __typename?: 'Middleware';
  /** Prettified Zod JSON structure for the middleware config schema, if provided */
  configSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the middleware config schema, if provided */
  configSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Events emitted by task/hook nodes that use this middleware */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to middleware file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Global middleware configuration */
  global: Maybe<GlobalMiddleware>;
  /** Middleware id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Middleware metadata */
  meta: Maybe<Meta>;
  /** Id of the resource that overrides this middleware (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this middleware (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this middleware (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
  /** Ids of resources that use this middleware */
  usedByResources: Array<Scalars['String']['output']>;
  /** Detailed resource usages with per-usage config */
  usedByResourcesDetailed: Array<MiddlewareResourceUsage>;
  /** Resources that use this middleware (resolved) */
  usedByResourcesResolved: Array<Resource>;
  /** Ids of task/hook nodes that use this middleware */
  usedByTasks: Array<Scalars['String']['output']>;
  /** Detailed task/hook usages with per-usage config */
  usedByTasksDetailed: Array<MiddlewareTaskUsage>;
  /** Task/hook nodes that use this middleware (resolved) */
  usedByTasksResolved: Array<Task>;
};


export type MiddlewareFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type MiddlewareResourceUsage = {
  __typename?: 'MiddlewareResourceUsage';
  config: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  node: Resource;
};

export type MiddlewareTaskUsage = {
  __typename?: 'MiddlewareTaskUsage';
  config: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  node: Task;
};

/** Kinds of executable nodes */
export type NodeKindEnum =
  | 'HOOK'
  | 'TASK';

/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type Query = {
  __typename?: 'Query';
  /** Unified view of all elements (tasks, hooks, resources, middleware, events). Prefer specific queries for efficiency. */
  all: Array<BaseElement>;
  /** Diagnostics for potential issues discovered by the introspector. */
  diagnostics: Array<Diagnostic>;
  /** Get a single event by its id. */
  event: Maybe<Event>;
  /** List events with optional filters. */
  events: Array<Event>;
  /** Get all hooks (optionally filter by id prefix). */
  hooks: Array<Hook>;
  /** Access live telemetry (logs, emissions, errors, runs, system stats). Always use filters and last to limit payload. */
  live: Live;
  /** Get a single middleware by its id. */
  middleware: Maybe<Middleware>;
  /** Get all middleware (optionally filter by id prefix). */
  middlewares: Array<Middleware>;
  /** Get a single resource by its id. */
  resource: Maybe<Resource>;
  /** Get all resource middlewares (optionally filter by id prefix). */
  resourceMiddlewares: Array<ResourceMiddleware>;
  /** Get all resources (optionally filter by id prefix). */
  resources: Array<Resource>;
  /** Root application 'resource'. This is what the main run() received as argument. */
  root: Maybe<Resource>;
  /** List of tasks currently hot-swapped. */
  swappedTasks: Array<SwappedTask>;
  /** Get reverse usage for a tag id. Returns usedBy lists split by kind. */
  tag: TagUsage;
  /** List all tags discovered across all elements. */
  tags: Array<Tag>;
  /** Get a single task by its id. */
  task: Maybe<Task>;
  /** Get all task middlewares (optionally filter by id prefix). */
  taskMiddlewares: Array<TaskMiddleware>;
  /** Get all tasks (optionally filter by id prefix). */
  tasks: Array<Task>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryAllArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryEventsArgs = {
  filter: InputMaybe<EventFilterInput>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryHooksArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryMiddlewareArgs = {
  id: Scalars['ID']['input'];
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryMiddlewaresArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryResourceArgs = {
  id: Scalars['ID']['input'];
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryResourceMiddlewaresArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryResourcesArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryTagArgs = {
  id: Scalars['ID']['input'];
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryTaskMiddlewaresArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};


/** Root queries for introspection, live telemetry, and debugging of Runner apps. */
export type QueryTasksArgs = {
  idIncludes: InputMaybe<Scalars['ID']['input']>;
};

export type Resource = BaseElement & {
  __typename?: 'Resource';
  /** Serialized resource config (if any) */
  config: Maybe<Scalars['String']['output']>;
  /** Prettified Zod JSON structure for the resource config schema, if provided */
  configSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the resource config schema, if provided */
  configSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Serialized context (if any) */
  context: Maybe<Scalars['String']['output']>;
  /** Ids of resources this resource depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Resources this resource depends on (resolved) */
  dependsOnResolved: Array<Resource>;
  /** Events emitted by tasks/hooks that depend on this resource */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to resource file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Resource id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Resource metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this resource */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this resource (resolved) */
  middlewareResolved: Array<ResourceMiddleware>;
  /** Middlewares applied to this resource with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Ids of items this resource overrides */
  overrides: Array<Scalars['String']['output']>;
  /** The registerable items this resource overrides (resolved) */
  overridesResolved: Array<BaseElement>;
  /** Id of the resource that registered this resource (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this resource (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Ids of items this resource registers */
  registers: Array<Scalars['String']['output']>;
  /** The items registered by this resource (resolved) */
  registersResolved: Array<BaseElement>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
  /** Task nodes using this resource (resolved) */
  usedBy: Array<Task>;
};


export type ResourceFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type ResourceMiddleware = BaseElement & {
  __typename?: 'ResourceMiddleware';
  /** Prettified Zod JSON structure for the middleware config schema, if provided */
  configSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the middleware config schema, if provided */
  configSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Events emitted by task/hook nodes that use this middleware */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to middleware file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Global middleware configuration */
  global: Maybe<GlobalMiddleware>;
  /** Middleware id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Middleware metadata */
  meta: Maybe<Meta>;
  /** Id of the resource that overrides this middleware (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this middleware (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this middleware (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
  /** Resources that use this middleware (resolved) */
  usedBy: Array<Resource>;
  /** Detailed resource usages with per-usage config */
  usedByDetailed: Array<MiddlewareResourceUsage>;
};


export type ResourceMiddlewareFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

/** Filters for execution run records */
export type RunFilterInput = {
  /** Filter by correlation ids */
  correlationIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific node ids */
  nodeIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific node kinds */
  nodeKinds: InputMaybe<Array<NodeKindEnum>>;
  /** Filter by success status */
  ok: InputMaybe<Scalars['Boolean']['input']>;
  /** Only include runs with specific parent ids */
  parentIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include runs with specific root ids */
  rootIds: InputMaybe<Array<Scalars['String']['input']>>;
};

export type RunRecord = {
  __typename?: 'RunRecord';
  /** Correlation id for tracing */
  correlationId: Maybe<Scalars['String']['output']>;
  /** Execution duration in milliseconds */
  durationMs: Scalars['Float']['output'];
  /** Error message (if failed) */
  error: Maybe<Scalars['String']['output']>;
  /** Id of the executed node */
  nodeId: Scalars['String']['output'];
  /** Kind of executed node */
  nodeKind: NodeKindEnum;
  /** Resolved executed node (task/hook) */
  nodeResolved: Maybe<BaseElement>;
  /** Whether execution succeeded */
  ok: Scalars['Boolean']['output'];
  /** Immediate parent caller id if available */
  parentId: Maybe<Scalars['String']['output']>;
  /** Root caller id that initiated the chain */
  rootId: Maybe<Scalars['String']['output']>;
  /** Run end time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Kinds of sources that can emit errors */
export type SourceKindEnum =
  | 'HOOK'
  | 'INTERNAL'
  | 'MIDDLEWARE'
  | 'RESOURCE'
  | 'TASK';

export type SwapResult = {
  __typename?: 'SwapResult';
  error: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  taskId: Scalars['String']['output'];
};

export type SwappedTask = {
  __typename?: 'SwappedTask';
  originalCode: Maybe<Scalars['String']['output']>;
  swappedAt: Scalars['Float']['output'];
  taskId: Scalars['String']['output'];
};

export type Tag = {
  __typename?: 'Tag';
  events: Array<Event>;
  hooks: Array<Hook>;
  id: Scalars['String']['output'];
  middlewares: Array<Middleware>;
  resources: Array<Resource>;
  tasks: Array<Task>;
};

export type TagUsage = {
  __typename?: 'TagUsage';
  all: Array<BaseElement>;
  events: Array<Event>;
  hooks: Array<Hook>;
  id: Scalars['ID']['output'];
  middlewares: Array<Middleware>;
  resources: Array<Resource>;
  tasks: Array<Task>;
};

export type Task = BaseElement & {
  __typename?: 'Task';
  /** Ids of resources/tasks this task depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Resolved dependencies and emitted events for this task */
  dependsOnResolved: TaskDependsOn;
  /** Flattened dependencies resolved to All (tasks, hooks, resources) */
  depenendsOnResolved: Array<BaseElement>;
  /** Event ids this task may emit (from dependencies) */
  emits: Array<Scalars['String']['output']>;
  /** Events emitted by this task (resolved) */
  emitsResolved: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to task file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Task id */
  id: Scalars['ID']['output'];
  /** Prettified Zod JSON structure for the input schema, if provided */
  inputSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the input schema, if provided */
  inputSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Task metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this task */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this task (resolved) */
  middlewareResolved: Array<TaskMiddleware>;
  /** Middlewares applied to this task with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Id of the resource that overrides this task (if any). Overriding replaces registrations at runtime. */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this task (if any). Useful to trace provenance. */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this task (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Execution run records for this task */
  runs: Array<RunRecord>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
};


export type TaskFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};


export type TaskRunsArgs = {
  afterTimestamp: InputMaybe<Scalars['Int']['input']>;
  filter: InputMaybe<RunFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};

export type TaskDependsOn = {
  __typename?: 'TaskDependsOn';
  /** Events this task emits */
  emitters: Array<Event>;
  /** Hooks this task depends on */
  hooks: Array<Hook>;
  /** Resources this task depends on */
  resources: Array<Resource>;
  /** Tasks this task depends on */
  tasks: Array<BaseElement>;
};

export type TaskMiddleware = BaseElement & {
  __typename?: 'TaskMiddleware';
  /** Prettified Zod JSON structure for the middleware config schema, if provided */
  configSchema: Maybe<Scalars['String']['output']>;
  /** Readable text representation of the middleware config schema, if provided */
  configSchemaReadable: Maybe<Scalars['String']['output']>;
  /** Events emitted by task/hook nodes that use this middleware */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to middleware file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Global middleware configuration */
  global: Maybe<GlobalMiddleware>;
  /** Middleware id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Middleware metadata */
  meta: Maybe<Meta>;
  /** Id of the resource that overrides this middleware (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this middleware (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this middleware (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
  /** Tags associated with this element. */
  tags: Maybe<Array<Tag>>;
  /** Task nodes that use this middleware (resolved) */
  usedBy: Array<Task>;
  /** Detailed task/hook usages with per-usage config */
  usedByDetailed: Array<MiddlewareTaskUsage>;
};


export type TaskMiddlewareFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type TaskMiddlewareUsage = {
  __typename?: 'TaskMiddlewareUsage';
  config: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  node: TaskMiddleware;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;


/** Mapping of interface types */
export type ResolversInterfaceTypes<_RefType extends Record<string, unknown>> = ResolversObject<{
  BaseElement: ( Omit<All, 'tags'> & { tags: Maybe<Array<_RefType['Tag']>> } ) | ( Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved' | 'tags'> & { emittedByResolved: Array<_RefType['BaseElement']>, listenedToByResolved: Array<_RefType['Hook']>, registeredByResolved: Maybe<_RefType['Resource']>, tags: Maybe<Array<_RefType['Tag']>> } ) | ( Omit<Hook, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['TaskMiddleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']>, runs: Array<_RefType['RunRecord']>, tags: Maybe<Array<_RefType['Tag']>> } ) | ( Omit<Middleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<_RefType['Event']>, registeredByResolved: Maybe<_RefType['Resource']>, tags: Maybe<Array<_RefType['Tag']>>, usedByResourcesDetailed: Array<_RefType['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<_RefType['Resource']>, usedByTasksDetailed: Array<_RefType['MiddlewareTaskUsage']>, usedByTasksResolved: Array<_RefType['Task']> } ) | ( Omit<Resource, 'dependsOnResolved' | 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'tags' | 'usedBy'> & { dependsOnResolved: Array<_RefType['Resource']>, emits: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['ResourceMiddleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, overridesResolved: Array<_RefType['BaseElement']>, registeredByResolved: Maybe<_RefType['Resource']>, registersResolved: Array<_RefType['BaseElement']>, tags: Maybe<Array<_RefType['Tag']>>, usedBy: Array<_RefType['Task']> } ) | ( Omit<ResourceMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<_RefType['Event']>, registeredByResolved: Maybe<_RefType['Resource']>, tags: Maybe<Array<_RefType['Tag']>>, usedBy: Array<_RefType['Resource']>, usedByDetailed: Array<_RefType['MiddlewareResourceUsage']> } ) | ( Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { dependsOnResolved: _RefType['TaskDependsOn'], depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['TaskMiddleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']>, runs: Array<_RefType['RunRecord']>, tags: Maybe<Array<_RefType['Tag']>> } ) | ( Omit<TaskMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<_RefType['Event']>, registeredByResolved: Maybe<_RefType['Resource']>, tags: Maybe<Array<_RefType['Tag']>>, usedBy: Array<_RefType['Task']>, usedByDetailed: Array<_RefType['MiddlewareTaskUsage']> } );
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  All: ResolverTypeWrapper<Omit<All, 'tags'> & { tags: Maybe<Array<ResolversTypes['Tag']>> }>;
  BaseElement: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['BaseElement']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CpuStats: ResolverTypeWrapper<CpuStats>;
  Diagnostic: ResolverTypeWrapper<Diagnostic>;
  EmissionEntry: ResolverTypeWrapper<Omit<EmissionEntry, 'emitterResolved' | 'eventResolved'> & { emitterResolved: Maybe<ResolversTypes['BaseElement']>, eventResolved: Maybe<ResolversTypes['Event']> }>;
  EmissionFilterInput: EmissionFilterInput;
  ErrorEntry: ResolverTypeWrapper<Omit<ErrorEntry, 'sourceResolved'> & { sourceResolved: Maybe<ResolversTypes['BaseElement']> }>;
  ErrorFilterInput: ErrorFilterInput;
  Event: ResolverTypeWrapper<Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved' | 'tags'> & { emittedByResolved: Array<ResolversTypes['BaseElement']>, listenedToByResolved: Array<ResolversTypes['Hook']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, tags: Maybe<Array<ResolversTypes['Tag']>> }>;
  EventFilterInput: EventFilterInput;
  EventLoopStats: ResolverTypeWrapper<EventLoopStats>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GcStats: ResolverTypeWrapper<GcStats>;
  GlobalMiddleware: ResolverTypeWrapper<GlobalMiddleware>;
  Hook: ResolverTypeWrapper<Omit<Hook, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { depenendsOnResolved: Array<ResolversTypes['BaseElement']>, emitsResolved: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['TaskMiddleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, runs: Array<ResolversTypes['RunRecord']>, tags: Maybe<Array<ResolversTypes['Tag']>> }>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Live: ResolverTypeWrapper<Omit<Live, 'emissions' | 'errors' | 'runs'> & { emissions: Array<ResolversTypes['EmissionEntry']>, errors: Array<ResolversTypes['ErrorEntry']>, runs: Array<ResolversTypes['RunRecord']> }>;
  LogEntry: ResolverTypeWrapper<LogEntry>;
  LogFilterInput: LogFilterInput;
  LogLevelEnum: LogLevelEnum;
  MemoryStats: ResolverTypeWrapper<MemoryStats>;
  Meta: ResolverTypeWrapper<Meta>;
  MetaTagUsage: ResolverTypeWrapper<MetaTagUsage>;
  Middleware: ResolverTypeWrapper<Omit<Middleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<ResolversTypes['Event']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, tags: Maybe<Array<ResolversTypes['Tag']>>, usedByResourcesDetailed: Array<ResolversTypes['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<ResolversTypes['Resource']>, usedByTasksDetailed: Array<ResolversTypes['MiddlewareTaskUsage']>, usedByTasksResolved: Array<ResolversTypes['Task']> }>;
  MiddlewareResourceUsage: ResolverTypeWrapper<Omit<MiddlewareResourceUsage, 'node'> & { node: ResolversTypes['Resource'] }>;
  MiddlewareTaskUsage: ResolverTypeWrapper<Omit<MiddlewareTaskUsage, 'node'> & { node: ResolversTypes['Task'] }>;
  NodeKindEnum: NodeKindEnum;
  Query: ResolverTypeWrapper<{}>;
  Resource: ResolverTypeWrapper<Omit<Resource, 'dependsOnResolved' | 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'tags' | 'usedBy'> & { dependsOnResolved: Array<ResolversTypes['Resource']>, emits: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['ResourceMiddleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, overridesResolved: Array<ResolversTypes['BaseElement']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, registersResolved: Array<ResolversTypes['BaseElement']>, tags: Maybe<Array<ResolversTypes['Tag']>>, usedBy: Array<ResolversTypes['Task']> }>;
  ResourceMiddleware: ResolverTypeWrapper<Omit<ResourceMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<ResolversTypes['Event']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, tags: Maybe<Array<ResolversTypes['Tag']>>, usedBy: Array<ResolversTypes['Resource']>, usedByDetailed: Array<ResolversTypes['MiddlewareResourceUsage']> }>;
  RunFilterInput: RunFilterInput;
  RunRecord: ResolverTypeWrapper<Omit<RunRecord, 'nodeResolved'> & { nodeResolved: Maybe<ResolversTypes['BaseElement']> }>;
  SourceKindEnum: SourceKindEnum;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SwapResult: ResolverTypeWrapper<SwapResult>;
  SwappedTask: ResolverTypeWrapper<SwappedTask>;
  Tag: ResolverTypeWrapper<Omit<Tag, 'events' | 'hooks' | 'middlewares' | 'resources' | 'tasks'> & { events: Array<ResolversTypes['Event']>, hooks: Array<ResolversTypes['Hook']>, middlewares: Array<ResolversTypes['Middleware']>, resources: Array<ResolversTypes['Resource']>, tasks: Array<ResolversTypes['Task']> }>;
  TagUsage: ResolverTypeWrapper<Omit<TagUsage, 'all' | 'events' | 'hooks' | 'middlewares' | 'resources' | 'tasks'> & { all: Array<ResolversTypes['BaseElement']>, events: Array<ResolversTypes['Event']>, hooks: Array<ResolversTypes['Hook']>, middlewares: Array<ResolversTypes['Middleware']>, resources: Array<ResolversTypes['Resource']>, tasks: Array<ResolversTypes['Task']> }>;
  Task: ResolverTypeWrapper<Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { dependsOnResolved: ResolversTypes['TaskDependsOn'], depenendsOnResolved: Array<ResolversTypes['BaseElement']>, emitsResolved: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['TaskMiddleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, runs: Array<ResolversTypes['RunRecord']>, tags: Maybe<Array<ResolversTypes['Tag']>> }>;
  TaskDependsOn: ResolverTypeWrapper<Omit<TaskDependsOn, 'emitters' | 'hooks' | 'resources' | 'tasks'> & { emitters: Array<ResolversTypes['Event']>, hooks: Array<ResolversTypes['Hook']>, resources: Array<ResolversTypes['Resource']>, tasks: Array<ResolversTypes['BaseElement']> }>;
  TaskMiddleware: ResolverTypeWrapper<Omit<TaskMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<ResolversTypes['Event']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, tags: Maybe<Array<ResolversTypes['Tag']>>, usedBy: Array<ResolversTypes['Task']>, usedByDetailed: Array<ResolversTypes['MiddlewareTaskUsage']> }>;
  TaskMiddlewareUsage: ResolverTypeWrapper<Omit<TaskMiddlewareUsage, 'node'> & { node: ResolversTypes['TaskMiddleware'] }>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  All: Omit<All, 'tags'> & { tags: Maybe<Array<ResolversParentTypes['Tag']>> };
  BaseElement: ResolversInterfaceTypes<ResolversParentTypes>['BaseElement'];
  Boolean: Scalars['Boolean']['output'];
  CpuStats: CpuStats;
  Diagnostic: Diagnostic;
  EmissionEntry: Omit<EmissionEntry, 'emitterResolved' | 'eventResolved'> & { emitterResolved: Maybe<ResolversParentTypes['BaseElement']>, eventResolved: Maybe<ResolversParentTypes['Event']> };
  EmissionFilterInput: EmissionFilterInput;
  ErrorEntry: Omit<ErrorEntry, 'sourceResolved'> & { sourceResolved: Maybe<ResolversParentTypes['BaseElement']> };
  ErrorFilterInput: ErrorFilterInput;
  Event: Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved' | 'tags'> & { emittedByResolved: Array<ResolversParentTypes['BaseElement']>, listenedToByResolved: Array<ResolversParentTypes['Hook']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, tags: Maybe<Array<ResolversParentTypes['Tag']>> };
  EventFilterInput: EventFilterInput;
  EventLoopStats: EventLoopStats;
  Float: Scalars['Float']['output'];
  GcStats: GcStats;
  GlobalMiddleware: GlobalMiddleware;
  Hook: Omit<Hook, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { depenendsOnResolved: Array<ResolversParentTypes['BaseElement']>, emitsResolved: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['TaskMiddleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, runs: Array<ResolversParentTypes['RunRecord']>, tags: Maybe<Array<ResolversParentTypes['Tag']>> };
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Live: Omit<Live, 'emissions' | 'errors' | 'runs'> & { emissions: Array<ResolversParentTypes['EmissionEntry']>, errors: Array<ResolversParentTypes['ErrorEntry']>, runs: Array<ResolversParentTypes['RunRecord']> };
  LogEntry: LogEntry;
  LogFilterInput: LogFilterInput;
  MemoryStats: MemoryStats;
  Meta: Meta;
  MetaTagUsage: MetaTagUsage;
  Middleware: Omit<Middleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<ResolversParentTypes['Event']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, tags: Maybe<Array<ResolversParentTypes['Tag']>>, usedByResourcesDetailed: Array<ResolversParentTypes['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<ResolversParentTypes['Resource']>, usedByTasksDetailed: Array<ResolversParentTypes['MiddlewareTaskUsage']>, usedByTasksResolved: Array<ResolversParentTypes['Task']> };
  MiddlewareResourceUsage: Omit<MiddlewareResourceUsage, 'node'> & { node: ResolversParentTypes['Resource'] };
  MiddlewareTaskUsage: Omit<MiddlewareTaskUsage, 'node'> & { node: ResolversParentTypes['Task'] };
  Query: {};
  Resource: Omit<Resource, 'dependsOnResolved' | 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'tags' | 'usedBy'> & { dependsOnResolved: Array<ResolversParentTypes['Resource']>, emits: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['ResourceMiddleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, overridesResolved: Array<ResolversParentTypes['BaseElement']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, registersResolved: Array<ResolversParentTypes['BaseElement']>, tags: Maybe<Array<ResolversParentTypes['Tag']>>, usedBy: Array<ResolversParentTypes['Task']> };
  ResourceMiddleware: Omit<ResourceMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<ResolversParentTypes['Event']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, tags: Maybe<Array<ResolversParentTypes['Tag']>>, usedBy: Array<ResolversParentTypes['Resource']>, usedByDetailed: Array<ResolversParentTypes['MiddlewareResourceUsage']> };
  RunFilterInput: RunFilterInput;
  RunRecord: Omit<RunRecord, 'nodeResolved'> & { nodeResolved: Maybe<ResolversParentTypes['BaseElement']> };
  String: Scalars['String']['output'];
  SwapResult: SwapResult;
  SwappedTask: SwappedTask;
  Tag: Omit<Tag, 'events' | 'hooks' | 'middlewares' | 'resources' | 'tasks'> & { events: Array<ResolversParentTypes['Event']>, hooks: Array<ResolversParentTypes['Hook']>, middlewares: Array<ResolversParentTypes['Middleware']>, resources: Array<ResolversParentTypes['Resource']>, tasks: Array<ResolversParentTypes['Task']> };
  TagUsage: Omit<TagUsage, 'all' | 'events' | 'hooks' | 'middlewares' | 'resources' | 'tasks'> & { all: Array<ResolversParentTypes['BaseElement']>, events: Array<ResolversParentTypes['Event']>, hooks: Array<ResolversParentTypes['Hook']>, middlewares: Array<ResolversParentTypes['Middleware']>, resources: Array<ResolversParentTypes['Resource']>, tasks: Array<ResolversParentTypes['Task']> };
  Task: Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved' | 'runs' | 'tags'> & { dependsOnResolved: ResolversParentTypes['TaskDependsOn'], depenendsOnResolved: Array<ResolversParentTypes['BaseElement']>, emitsResolved: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['TaskMiddleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, runs: Array<ResolversParentTypes['RunRecord']>, tags: Maybe<Array<ResolversParentTypes['Tag']>> };
  TaskDependsOn: Omit<TaskDependsOn, 'emitters' | 'hooks' | 'resources' | 'tasks'> & { emitters: Array<ResolversParentTypes['Event']>, hooks: Array<ResolversParentTypes['Hook']>, resources: Array<ResolversParentTypes['Resource']>, tasks: Array<ResolversParentTypes['BaseElement']> };
  TaskMiddleware: Omit<TaskMiddleware, 'emits' | 'registeredByResolved' | 'tags' | 'usedBy' | 'usedByDetailed'> & { emits: Array<ResolversParentTypes['Event']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, tags: Maybe<Array<ResolversParentTypes['Tag']>>, usedBy: Array<ResolversParentTypes['Task']>, usedByDetailed: Array<ResolversParentTypes['MiddlewareTaskUsage']> };
  TaskMiddlewareUsage: Omit<TaskMiddlewareUsage, 'node'> & { node: ResolversParentTypes['TaskMiddleware'] };
}>;

export type AllResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['All'] = ResolversParentTypes['All']> = ResolversObject<{
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, AllFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BaseElementResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['BaseElement'] = ResolversParentTypes['BaseElement']> = ResolversObject<{
  __resolveType: TypeResolveFn<'All' | 'Event' | 'Hook' | 'Middleware' | 'Resource' | 'ResourceMiddleware' | 'Task' | 'TaskMiddleware', ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, BaseElementFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
}>;

export type CpuStatsResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['CpuStats'] = ResolversParentTypes['CpuStats']> = ResolversObject<{
  loadAverage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  usage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type DiagnosticResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Diagnostic'] = ResolversParentTypes['Diagnostic']> = ResolversObject<{
  code: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nodeId: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  nodeKind: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  severity: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EmissionEntryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['EmissionEntry'] = ResolversParentTypes['EmissionEntry']> = ResolversObject<{
  correlationId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emitterId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emitterResolved: Resolver<Maybe<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  eventId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventResolved: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType>;
  payload: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ErrorEntryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['ErrorEntry'] = ResolversParentTypes['ErrorEntry']> = ResolversObject<{
  correlationId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  data: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sourceId: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  sourceKind: Resolver<ResolversTypes['SourceKindEnum'], ParentType, ContextType>;
  sourceResolved: Resolver<Maybe<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  stack: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Event'] = ResolversParentTypes['Event']> = ResolversObject<{
  emittedBy: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  emittedByResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, EventFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  listenedToBy: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  listenedToByResolved: Resolver<Array<ResolversTypes['Hook']>, ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  payloadSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  payloadSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EventLoopStatsResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['EventLoopStats'] = ResolversParentTypes['EventLoopStats']> = ResolversObject<{
  lag: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GcStatsResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['GcStats'] = ResolversParentTypes['GcStats']> = ResolversObject<{
  collections: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  duration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GlobalMiddlewareResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['GlobalMiddleware'] = ResolversParentTypes['GlobalMiddleware']> = ResolversObject<{
  enabled: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resources: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  tasks: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type HookResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Hook'] = ResolversParentTypes['Hook']> = ResolversObject<{
  dependsOn: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  depenendsOnResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  emitsResolved: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  event: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, HookFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hookOrder: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  inputSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  inputSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['TaskMiddleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  runs: Resolver<Array<ResolversTypes['RunRecord']>, ParentType, ContextType, HookRunsArgs>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LiveResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Live'] = ResolversParentTypes['Live']> = ResolversObject<{
  cpu: Resolver<ResolversTypes['CpuStats'], ParentType, ContextType>;
  emissions: Resolver<Array<ResolversTypes['EmissionEntry']>, ParentType, ContextType, LiveEmissionsArgs>;
  errors: Resolver<Array<ResolversTypes['ErrorEntry']>, ParentType, ContextType, LiveErrorsArgs>;
  eventLoop: Resolver<ResolversTypes['EventLoopStats'], ParentType, ContextType, LiveEventLoopArgs>;
  gc: Resolver<ResolversTypes['GcStats'], ParentType, ContextType, LiveGcArgs>;
  logs: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType, LiveLogsArgs>;
  memory: Resolver<ResolversTypes['MemoryStats'], ParentType, ContextType>;
  runs: Resolver<Array<ResolversTypes['RunRecord']>, ParentType, ContextType, LiveRunsArgs>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LogEntryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['LogEntry'] = ResolversParentTypes['LogEntry']> = ResolversObject<{
  correlationId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  data: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  level: Resolver<ResolversTypes['LogLevelEnum'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MemoryStatsResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MemoryStats'] = ResolversParentTypes['MemoryStats']> = ResolversObject<{
  heapTotal: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  heapUsed: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  rss: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MetaResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Meta'] = ResolversParentTypes['Meta']> = ResolversObject<{
  description: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tags: Resolver<Array<ResolversTypes['MetaTagUsage']>, ParentType, ContextType>;
  title: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MetaTagUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MetaTagUsage'] = ResolversParentTypes['MetaTagUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MiddlewareResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Middleware'] = ResolversParentTypes['Middleware']> = ResolversObject<{
  configSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  configSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, MiddlewareFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  global: Resolver<Maybe<ResolversTypes['GlobalMiddleware']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  usedByResources: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  usedByResourcesDetailed: Resolver<Array<ResolversTypes['MiddlewareResourceUsage']>, ParentType, ContextType>;
  usedByResourcesResolved: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  usedByTasks: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  usedByTasksDetailed: Resolver<Array<ResolversTypes['MiddlewareTaskUsage']>, ParentType, ContextType>;
  usedByTasksResolved: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MiddlewareResourceUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MiddlewareResourceUsage'] = ResolversParentTypes['MiddlewareResourceUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['Resource'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MiddlewareTaskUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MiddlewareTaskUsage'] = ResolversParentTypes['MiddlewareTaskUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['Task'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  all: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType, QueryAllArgs>;
  diagnostics: Resolver<Array<ResolversTypes['Diagnostic']>, ParentType, ContextType>;
  event: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventArgs, 'id'>>;
  events: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType, QueryEventsArgs>;
  hooks: Resolver<Array<ResolversTypes['Hook']>, ParentType, ContextType, QueryHooksArgs>;
  live: Resolver<ResolversTypes['Live'], ParentType, ContextType>;
  middleware: Resolver<Maybe<ResolversTypes['Middleware']>, ParentType, ContextType, RequireFields<QueryMiddlewareArgs, 'id'>>;
  middlewares: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType, QueryMiddlewaresArgs>;
  resource: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType, RequireFields<QueryResourceArgs, 'id'>>;
  resourceMiddlewares: Resolver<Array<ResolversTypes['ResourceMiddleware']>, ParentType, ContextType, QueryResourceMiddlewaresArgs>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType, QueryResourcesArgs>;
  root: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  swappedTasks: Resolver<Array<ResolversTypes['SwappedTask']>, ParentType, ContextType>;
  tag: Resolver<ResolversTypes['TagUsage'], ParentType, ContextType, RequireFields<QueryTagArgs, 'id'>>;
  tags: Resolver<Array<ResolversTypes['Tag']>, ParentType, ContextType>;
  task: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryTaskArgs, 'id'>>;
  taskMiddlewares: Resolver<Array<ResolversTypes['TaskMiddleware']>, ParentType, ContextType, QueryTaskMiddlewaresArgs>;
  tasks: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType, QueryTasksArgs>;
}>;

export type ResourceResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Resource'] = ResolversParentTypes['Resource']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  configSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  configSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  context: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dependsOn: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  dependsOnResolved: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, ResourceFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['ResourceMiddleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overrides: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  overridesResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  registers: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  registersResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  usedBy: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ResourceMiddlewareResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['ResourceMiddleware'] = ResolversParentTypes['ResourceMiddleware']> = ResolversObject<{
  configSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  configSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, ResourceMiddlewareFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  global: Resolver<Maybe<ResolversTypes['GlobalMiddleware']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  usedBy: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  usedByDetailed: Resolver<Array<ResolversTypes['MiddlewareResourceUsage']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RunRecordResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['RunRecord'] = ResolversParentTypes['RunRecord']> = ResolversObject<{
  correlationId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  durationMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nodeId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nodeKind: Resolver<ResolversTypes['NodeKindEnum'], ParentType, ContextType>;
  nodeResolved: Resolver<Maybe<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  ok: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  parentId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rootId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SwapResultResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['SwapResult'] = ResolversParentTypes['SwapResult']> = ResolversObject<{
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  taskId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SwappedTaskResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['SwappedTask'] = ResolversParentTypes['SwappedTask']> = ResolversObject<{
  originalCode: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  swappedAt: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  taskId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TagResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Tag'] = ResolversParentTypes['Tag']> = ResolversObject<{
  events: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  hooks: Resolver<Array<ResolversTypes['Hook']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  middlewares: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  tasks: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TagUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TagUsage'] = ResolversParentTypes['TagUsage']> = ResolversObject<{
  all: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  events: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  hooks: Resolver<Array<ResolversTypes['Hook']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  middlewares: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  tasks: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Task'] = ResolversParentTypes['Task']> = ResolversObject<{
  dependsOn: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  dependsOnResolved: Resolver<ResolversTypes['TaskDependsOn'], ParentType, ContextType>;
  depenendsOnResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  emitsResolved: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, TaskFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  inputSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  inputSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['TaskMiddleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  runs: Resolver<Array<ResolversTypes['RunRecord']>, ParentType, ContextType, TaskRunsArgs>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskDependsOnResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskDependsOn'] = ResolversParentTypes['TaskDependsOn']> = ResolversObject<{
  emitters: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  hooks: Resolver<Array<ResolversTypes['Hook']>, ParentType, ContextType>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  tasks: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskMiddlewareResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskMiddleware'] = ResolversParentTypes['TaskMiddleware']> = ResolversObject<{
  configSchema: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  configSchemaReadable: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, TaskMiddlewareFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  global: Resolver<Maybe<ResolversTypes['GlobalMiddleware']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  tags: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
  usedBy: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType>;
  usedByDetailed: Resolver<Array<ResolversTypes['MiddlewareTaskUsage']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskMiddlewareUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskMiddlewareUsage'] = ResolversParentTypes['TaskMiddlewareUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['TaskMiddleware'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = CustomGraphQLContext> = ResolversObject<{
  All: AllResolvers<ContextType>;
  BaseElement: BaseElementResolvers<ContextType>;
  CpuStats: CpuStatsResolvers<ContextType>;
  Diagnostic: DiagnosticResolvers<ContextType>;
  EmissionEntry: EmissionEntryResolvers<ContextType>;
  ErrorEntry: ErrorEntryResolvers<ContextType>;
  Event: EventResolvers<ContextType>;
  EventLoopStats: EventLoopStatsResolvers<ContextType>;
  GcStats: GcStatsResolvers<ContextType>;
  GlobalMiddleware: GlobalMiddlewareResolvers<ContextType>;
  Hook: HookResolvers<ContextType>;
  Live: LiveResolvers<ContextType>;
  LogEntry: LogEntryResolvers<ContextType>;
  MemoryStats: MemoryStatsResolvers<ContextType>;
  Meta: MetaResolvers<ContextType>;
  MetaTagUsage: MetaTagUsageResolvers<ContextType>;
  Middleware: MiddlewareResolvers<ContextType>;
  MiddlewareResourceUsage: MiddlewareResourceUsageResolvers<ContextType>;
  MiddlewareTaskUsage: MiddlewareTaskUsageResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Resource: ResourceResolvers<ContextType>;
  ResourceMiddleware: ResourceMiddlewareResolvers<ContextType>;
  RunRecord: RunRecordResolvers<ContextType>;
  SwapResult: SwapResultResolvers<ContextType>;
  SwappedTask: SwappedTaskResolvers<ContextType>;
  Tag: TagResolvers<ContextType>;
  TagUsage: TagUsageResolvers<ContextType>;
  Task: TaskResolvers<ContextType>;
  TaskDependsOn: TaskDependsOnResolvers<ContextType>;
  TaskMiddleware: TaskMiddlewareResolvers<ContextType>;
  TaskMiddlewareUsage: TaskMiddlewareUsageResolvers<ContextType>;
}>;

