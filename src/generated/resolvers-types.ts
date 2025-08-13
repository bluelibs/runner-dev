import { GraphQLResolveInfo } from 'graphql';
import { CustomGraphQLContext } from '../graphql/context';
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

export type All = BaseElement & {
  __typename?: 'All';
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to root resource file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Application root id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Application root metadata */
  meta: Maybe<Meta>;
};


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
  /** Emitter id when available */
  emitterId: Maybe<Scalars['String']['output']>;
  /** Resolved emitter node (task/listener/resource/middleware) if known; otherwise returns a minimal All node */
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
  /** Only include specific emitter ids */
  emitterIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific event ids */
  eventIds: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ErrorEntry = {
  __typename?: 'ErrorEntry';
  /** Stringified JSON if object */
  data: Maybe<Scalars['String']['output']>;
  /** Error message */
  message: Scalars['String']['output'];
  /** Id of the source that emitted the error */
  sourceId: Scalars['ID']['output'];
  /** Kind of source (task/listener/resource/middleware/internal) */
  sourceKind: SourceKindEnum;
  /** Resolved source node (task/listener/resource/middleware), else minimal All */
  sourceResolved: Maybe<BaseElement>;
  /** Error stack when available */
  stack: Maybe<Scalars['String']['output']>;
  /** Error time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Filters for captured errors */
export type ErrorFilterInput = {
  /** Substring match inside error message */
  messageIncludes: InputMaybe<Scalars['String']['input']>;
  /** Only include errors from specific source ids */
  sourceIds: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Only include errors from specific source kinds */
  sourceKinds: InputMaybe<Array<SourceKindEnum>>;
};

export type Event = BaseElement & {
  __typename?: 'Event';
  /** Ids of task/listener nodes that emit this event */
  emittedBy: Array<Scalars['String']['output']>;
  /** Task/listener nodes that emit this event (resolved) */
  emittedByResolved: Array<TaskInterface>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to event file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Event id */
  id: Scalars['ID']['output'];
  /** Ids of task/listener nodes listening to this event */
  listenedToBy: Array<Scalars['String']['output']>;
  /** Task/listener nodes listening to this event (resolved) */
  listenedToByResolved: Array<TaskInterface>;
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Event metadata */
  meta: Maybe<Meta>;
  /** Id of the resource that registered this event (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this event (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
};


export type EventFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type EventFilterInput = {
  hasNoListeners: InputMaybe<Scalars['Boolean']['input']>;
  hideSystem: InputMaybe<Scalars['Boolean']['input']>;
  idStartsWith: InputMaybe<Scalars['String']['input']>;
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

export type Listener = BaseElement & TaskInterface & {
  __typename?: 'Listener';
  /** Ids of resources/tasks this listener depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Flattened dependencies resolved to All (tasks, listeners, resources) */
  depenendsOnResolved: Array<BaseElement>;
  /** Event ids this listener may emit (from dependencies) */
  emits: Array<Scalars['String']['output']>;
  /** Events emitted by this listener (resolved) */
  emitsResolved: Array<Event>;
  /** The event id this listener listens to */
  event: Scalars['String']['output'];
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to listener file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Listener id */
  id: Scalars['ID']['output'];
  /** Execution order among listeners for the same event */
  listenerOrder: Maybe<Scalars['Int']['output']>;
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Listener metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this listener */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this listener (resolved) */
  middlewareResolved: Array<Middleware>;
  /** Middlewares applied to this listener with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Id of the resource that overrides this listener (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this listener (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this listener (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
};


export type ListenerFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type Live = {
  __typename?: 'Live';
  /** Event emissions with optional timestamp cursor, filters and last N */
  emissions: Array<EmissionEntry>;
  /** Errors captured with optional timestamp cursor, filters and last N */
  errors: Array<ErrorEntry>;
  /** Live logs with optional timestamp cursor, filters and last N */
  logs: Array<LogEntry>;
  /** Execution run records with optional timestamp cursor, filters and last N */
  runs: Array<RunRecord>;
};


export type LiveEmissionsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<EmissionFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


export type LiveErrorsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<ErrorFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


export type LiveLogsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<LogFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};


export type LiveRunsArgs = {
  afterTimestamp: InputMaybe<Scalars['Float']['input']>;
  filter: InputMaybe<RunFilterInput>;
  last: InputMaybe<Scalars['Int']['input']>;
};

export type LogEntry = {
  __typename?: 'LogEntry';
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
  /** Events emitted by task/listener nodes that use this middleware */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
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
  /** Ids of resources that use this middleware */
  usedByResources: Array<Scalars['String']['output']>;
  /** Detailed resource usages with per-usage config */
  usedByResourcesDetailed: Array<MiddlewareResourceUsage>;
  /** Resources that use this middleware (resolved) */
  usedByResourcesResolved: Array<Resource>;
  /** Ids of task/listener nodes that use this middleware */
  usedByTasks: Array<Scalars['String']['output']>;
  /** Detailed task/listener usages with per-usage config */
  usedByTasksDetailed: Array<MiddlewareTaskUsage>;
  /** Task/listener nodes that use this middleware (resolved) */
  usedByTasksResolved: Array<TaskInterface>;
};


export type MiddlewareFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type MiddlewareResourceUsage = {
  __typename?: 'MiddlewareResourceUsage';
  config: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  node: Resource;
};

export type MiddlewareTaskUsage = {
  __typename?: 'MiddlewareTaskUsage';
  config: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  node: TaskInterface;
};

/** Kinds of executable nodes */
export type NodeKindEnum =
  | 'LISTENER'
  | 'TASK';

export type Query = {
  __typename?: 'Query';
  all: Array<All>;
  diagnostics: Array<Diagnostic>;
  event: Maybe<Event>;
  events: Array<Event>;
  listeners: Array<Listener>;
  live: Live;
  middleware: Maybe<Middleware>;
  middlewares: Array<Middleware>;
  resource: Maybe<Resource>;
  resources: Array<Resource>;
  root: Maybe<Resource>;
  task: Maybe<Task>;
  tasks: Array<Task>;
};


export type QueryEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryEventsArgs = {
  filter: InputMaybe<EventFilterInput>;
};


export type QueryListenersArgs = {
  idStartsWith: InputMaybe<Scalars['ID']['input']>;
};


export type QueryMiddlewareArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMiddlewaresArgs = {
  idStartsWith: InputMaybe<Scalars['ID']['input']>;
};


export type QueryResourceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryResourcesArgs = {
  idStartsWith: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  idStartsWith: InputMaybe<Scalars['ID']['input']>;
};

export type Resource = BaseElement & {
  __typename?: 'Resource';
  /** Serialized resource config (if any) */
  config: Maybe<Scalars['String']['output']>;
  /** Serialized context (if any) */
  context: Maybe<Scalars['String']['output']>;
  /** Events emitted by tasks/listeners that depend on this resource */
  emits: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
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
  middlewareResolved: Array<Middleware>;
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
  /** Task/listener nodes using this resource (resolved) */
  usedBy: Array<TaskInterface>;
};


export type ResourceFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

/** Filters for execution run records */
export type RunFilterInput = {
  /** Only include specific node ids */
  nodeIds: InputMaybe<Array<Scalars['String']['input']>>;
  /** Only include specific node kinds */
  nodeKinds: InputMaybe<Array<NodeKindEnum>>;
  /** Filter by success status */
  ok: InputMaybe<Scalars['Boolean']['input']>;
};

export type RunRecord = {
  __typename?: 'RunRecord';
  /** Execution duration in milliseconds */
  durationMs: Scalars['Float']['output'];
  /** Error message (if failed) */
  error: Maybe<Scalars['String']['output']>;
  /** Id of the executed node */
  nodeId: Scalars['String']['output'];
  /** Kind of executed node */
  nodeKind: NodeKindEnum;
  /** Resolved task/listener node */
  nodeResolved: Maybe<TaskInterface>;
  /** Whether execution succeeded */
  ok: Scalars['Boolean']['output'];
  /** Run end time (milliseconds since epoch) */
  timestampMs: Scalars['Float']['output'];
};

/** Kinds of sources that can emit errors */
export type SourceKindEnum =
  | 'INTERNAL'
  | 'LISTENER'
  | 'MIDDLEWARE'
  | 'RESOURCE'
  | 'TASK';

export type Task = BaseElement & TaskInterface & {
  __typename?: 'Task';
  /** Ids of resources/tasks this task depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Resolved dependencies and emitted events for this task */
  dependsOnResolved: TaskDependsOn;
  /** Flattened dependencies resolved to All (tasks, listeners, resources) */
  depenendsOnResolved: Array<BaseElement>;
  /** Event ids this task may emit (from dependencies) */
  emits: Array<Scalars['String']['output']>;
  /** Events emitted by this task (resolved) */
  emitsResolved: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to task file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Task id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Task metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this task */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this task (resolved) */
  middlewareResolved: Array<Middleware>;
  /** Middlewares applied to this task with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Id of the resource that overrides this task (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this task (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this task (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
};


export type TaskFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type TaskDependsOn = {
  __typename?: 'TaskDependsOn';
  /** Events this task emits */
  emitters: Array<Event>;
  /** Listeners this task depends on */
  listeners: Array<TaskInterface>;
  /** Resources this task depends on */
  resources: Array<Resource>;
  /** Tasks this task depends on */
  tasks: Array<TaskInterface>;
};

/** Common fields for Task and Listener */
export type TaskInterface = {
  /** Ids of resources/tasks this task depends on */
  dependsOn: Array<Scalars['String']['output']>;
  /** Flattened dependencies resolved to All (tasks, listeners, resources) */
  depenendsOnResolved: Array<BaseElement>;
  /** Event ids this task may emit (from dependencies) */
  emits: Array<Scalars['String']['output']>;
  /** Events emitted by this task (resolved) */
  emitsResolved: Array<Event>;
  /** Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. */
  fileContents: Maybe<Scalars['String']['output']>;
  /** Path to task file */
  filePath: Maybe<Scalars['String']['output']>;
  /** Task id */
  id: Scalars['ID']['output'];
  /** Markdown composed from meta.title and meta.description (if present) */
  markdownDescription: Scalars['String']['output'];
  /** Task metadata */
  meta: Maybe<Meta>;
  /** Ids of middlewares applied to this task */
  middleware: Array<Scalars['String']['output']>;
  /** Middlewares applied to this task (resolved) */
  middlewareResolved: Array<Middleware>;
  /** Middlewares applied to this task with per-usage config */
  middlewareResolvedDetailed: Array<TaskMiddlewareUsage>;
  /** Id of the resource that overrides this task (if any) */
  overriddenBy: Maybe<Scalars['String']['output']>;
  /** Id of the resource that registered this task (if any) */
  registeredBy: Maybe<Scalars['String']['output']>;
  /** Resource that registered this task (resolved, if any) */
  registeredByResolved: Maybe<Resource>;
};


/** Common fields for Task and Listener */
export type TaskInterfaceFileContentsArgs = {
  endLine: InputMaybe<Scalars['Int']['input']>;
  startLine: InputMaybe<Scalars['Int']['input']>;
};

export type TaskMiddlewareUsage = {
  __typename?: 'TaskMiddlewareUsage';
  config: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  node: Middleware;
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
  BaseElement: ( All ) | ( Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved'> & { emittedByResolved: Array<_RefType['TaskInterface']>, listenedToByResolved: Array<_RefType['TaskInterface']>, registeredByResolved: Maybe<_RefType['Resource']> } ) | ( Omit<Listener, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['Middleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']> } ) | ( Omit<Middleware, 'emits' | 'registeredByResolved' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<_RefType['Event']>, registeredByResolved: Maybe<_RefType['Resource']>, usedByResourcesDetailed: Array<_RefType['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<_RefType['Resource']>, usedByTasksDetailed: Array<_RefType['MiddlewareTaskUsage']>, usedByTasksResolved: Array<_RefType['TaskInterface']> } ) | ( Omit<Resource, 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'usedBy'> & { emits: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['Middleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, overridesResolved: Array<_RefType['BaseElement']>, registeredByResolved: Maybe<_RefType['Resource']>, registersResolved: Array<_RefType['BaseElement']>, usedBy: Array<_RefType['TaskInterface']> } ) | ( Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { dependsOnResolved: _RefType['TaskDependsOn'], depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['Middleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']> } );
  TaskInterface: ( Omit<Listener, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['Middleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']> } ) | ( Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { dependsOnResolved: _RefType['TaskDependsOn'], depenendsOnResolved: Array<_RefType['BaseElement']>, emitsResolved: Array<_RefType['Event']>, middlewareResolved: Array<_RefType['Middleware']>, middlewareResolvedDetailed: Array<_RefType['TaskMiddlewareUsage']>, registeredByResolved: Maybe<_RefType['Resource']> } );
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  All: ResolverTypeWrapper<All>;
  BaseElement: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['BaseElement']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Diagnostic: ResolverTypeWrapper<Diagnostic>;
  EmissionEntry: ResolverTypeWrapper<Omit<EmissionEntry, 'emitterResolved' | 'eventResolved'> & { emitterResolved: Maybe<ResolversTypes['BaseElement']>, eventResolved: Maybe<ResolversTypes['Event']> }>;
  EmissionFilterInput: EmissionFilterInput;
  ErrorEntry: ResolverTypeWrapper<Omit<ErrorEntry, 'sourceResolved'> & { sourceResolved: Maybe<ResolversTypes['BaseElement']> }>;
  ErrorFilterInput: ErrorFilterInput;
  Event: ResolverTypeWrapper<Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved'> & { emittedByResolved: Array<ResolversTypes['TaskInterface']>, listenedToByResolved: Array<ResolversTypes['TaskInterface']>, registeredByResolved: Maybe<ResolversTypes['Resource']> }>;
  EventFilterInput: EventFilterInput;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GlobalMiddleware: ResolverTypeWrapper<GlobalMiddleware>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Listener: ResolverTypeWrapper<Omit<Listener, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { depenendsOnResolved: Array<ResolversTypes['BaseElement']>, emitsResolved: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversTypes['Resource']> }>;
  Live: ResolverTypeWrapper<Omit<Live, 'emissions' | 'errors' | 'runs'> & { emissions: Array<ResolversTypes['EmissionEntry']>, errors: Array<ResolversTypes['ErrorEntry']>, runs: Array<ResolversTypes['RunRecord']> }>;
  LogEntry: ResolverTypeWrapper<LogEntry>;
  LogFilterInput: LogFilterInput;
  LogLevelEnum: LogLevelEnum;
  Meta: ResolverTypeWrapper<Meta>;
  MetaTagUsage: ResolverTypeWrapper<MetaTagUsage>;
  Middleware: ResolverTypeWrapper<Omit<Middleware, 'emits' | 'registeredByResolved' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<ResolversTypes['Event']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, usedByResourcesDetailed: Array<ResolversTypes['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<ResolversTypes['Resource']>, usedByTasksDetailed: Array<ResolversTypes['MiddlewareTaskUsage']>, usedByTasksResolved: Array<ResolversTypes['TaskInterface']> }>;
  MiddlewareResourceUsage: ResolverTypeWrapper<Omit<MiddlewareResourceUsage, 'node'> & { node: ResolversTypes['Resource'] }>;
  MiddlewareTaskUsage: ResolverTypeWrapper<Omit<MiddlewareTaskUsage, 'node'> & { node: ResolversTypes['TaskInterface'] }>;
  NodeKindEnum: NodeKindEnum;
  Query: ResolverTypeWrapper<{}>;
  Resource: ResolverTypeWrapper<Omit<Resource, 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'usedBy'> & { emits: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, overridesResolved: Array<ResolversTypes['BaseElement']>, registeredByResolved: Maybe<ResolversTypes['Resource']>, registersResolved: Array<ResolversTypes['BaseElement']>, usedBy: Array<ResolversTypes['TaskInterface']> }>;
  RunFilterInput: RunFilterInput;
  RunRecord: ResolverTypeWrapper<Omit<RunRecord, 'nodeResolved'> & { nodeResolved: Maybe<ResolversTypes['TaskInterface']> }>;
  SourceKindEnum: SourceKindEnum;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Task: ResolverTypeWrapper<Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { dependsOnResolved: ResolversTypes['TaskDependsOn'], depenendsOnResolved: Array<ResolversTypes['BaseElement']>, emitsResolved: Array<ResolversTypes['Event']>, middlewareResolved: Array<ResolversTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversTypes['Resource']> }>;
  TaskDependsOn: ResolverTypeWrapper<Omit<TaskDependsOn, 'emitters' | 'listeners' | 'resources' | 'tasks'> & { emitters: Array<ResolversTypes['Event']>, listeners: Array<ResolversTypes['TaskInterface']>, resources: Array<ResolversTypes['Resource']>, tasks: Array<ResolversTypes['TaskInterface']> }>;
  TaskInterface: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['TaskInterface']>;
  TaskMiddlewareUsage: ResolverTypeWrapper<Omit<TaskMiddlewareUsage, 'node'> & { node: ResolversTypes['Middleware'] }>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  All: All;
  BaseElement: ResolversInterfaceTypes<ResolversParentTypes>['BaseElement'];
  Boolean: Scalars['Boolean']['output'];
  Diagnostic: Diagnostic;
  EmissionEntry: Omit<EmissionEntry, 'emitterResolved' | 'eventResolved'> & { emitterResolved: Maybe<ResolversParentTypes['BaseElement']>, eventResolved: Maybe<ResolversParentTypes['Event']> };
  EmissionFilterInput: EmissionFilterInput;
  ErrorEntry: Omit<ErrorEntry, 'sourceResolved'> & { sourceResolved: Maybe<ResolversParentTypes['BaseElement']> };
  ErrorFilterInput: ErrorFilterInput;
  Event: Omit<Event, 'emittedByResolved' | 'listenedToByResolved' | 'registeredByResolved'> & { emittedByResolved: Array<ResolversParentTypes['TaskInterface']>, listenedToByResolved: Array<ResolversParentTypes['TaskInterface']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']> };
  EventFilterInput: EventFilterInput;
  Float: Scalars['Float']['output'];
  GlobalMiddleware: GlobalMiddleware;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Listener: Omit<Listener, 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { depenendsOnResolved: Array<ResolversParentTypes['BaseElement']>, emitsResolved: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']> };
  Live: Omit<Live, 'emissions' | 'errors' | 'runs'> & { emissions: Array<ResolversParentTypes['EmissionEntry']>, errors: Array<ResolversParentTypes['ErrorEntry']>, runs: Array<ResolversParentTypes['RunRecord']> };
  LogEntry: LogEntry;
  LogFilterInput: LogFilterInput;
  Meta: Meta;
  MetaTagUsage: MetaTagUsage;
  Middleware: Omit<Middleware, 'emits' | 'registeredByResolved' | 'usedByResourcesDetailed' | 'usedByResourcesResolved' | 'usedByTasksDetailed' | 'usedByTasksResolved'> & { emits: Array<ResolversParentTypes['Event']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, usedByResourcesDetailed: Array<ResolversParentTypes['MiddlewareResourceUsage']>, usedByResourcesResolved: Array<ResolversParentTypes['Resource']>, usedByTasksDetailed: Array<ResolversParentTypes['MiddlewareTaskUsage']>, usedByTasksResolved: Array<ResolversParentTypes['TaskInterface']> };
  MiddlewareResourceUsage: Omit<MiddlewareResourceUsage, 'node'> & { node: ResolversParentTypes['Resource'] };
  MiddlewareTaskUsage: Omit<MiddlewareTaskUsage, 'node'> & { node: ResolversParentTypes['TaskInterface'] };
  Query: {};
  Resource: Omit<Resource, 'emits' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'overridesResolved' | 'registeredByResolved' | 'registersResolved' | 'usedBy'> & { emits: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, overridesResolved: Array<ResolversParentTypes['BaseElement']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']>, registersResolved: Array<ResolversParentTypes['BaseElement']>, usedBy: Array<ResolversParentTypes['TaskInterface']> };
  RunFilterInput: RunFilterInput;
  RunRecord: Omit<RunRecord, 'nodeResolved'> & { nodeResolved: Maybe<ResolversParentTypes['TaskInterface']> };
  String: Scalars['String']['output'];
  Task: Omit<Task, 'dependsOnResolved' | 'depenendsOnResolved' | 'emitsResolved' | 'middlewareResolved' | 'middlewareResolvedDetailed' | 'registeredByResolved'> & { dependsOnResolved: ResolversParentTypes['TaskDependsOn'], depenendsOnResolved: Array<ResolversParentTypes['BaseElement']>, emitsResolved: Array<ResolversParentTypes['Event']>, middlewareResolved: Array<ResolversParentTypes['Middleware']>, middlewareResolvedDetailed: Array<ResolversParentTypes['TaskMiddlewareUsage']>, registeredByResolved: Maybe<ResolversParentTypes['Resource']> };
  TaskDependsOn: Omit<TaskDependsOn, 'emitters' | 'listeners' | 'resources' | 'tasks'> & { emitters: Array<ResolversParentTypes['Event']>, listeners: Array<ResolversParentTypes['TaskInterface']>, resources: Array<ResolversParentTypes['Resource']>, tasks: Array<ResolversParentTypes['TaskInterface']> };
  TaskInterface: ResolversInterfaceTypes<ResolversParentTypes>['TaskInterface'];
  TaskMiddlewareUsage: Omit<TaskMiddlewareUsage, 'node'> & { node: ResolversParentTypes['Middleware'] };
}>;

export type AllResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['All'] = ResolversParentTypes['All']> = ResolversObject<{
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, AllFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BaseElementResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['BaseElement'] = ResolversParentTypes['BaseElement']> = ResolversObject<{
  __resolveType: TypeResolveFn<'All' | 'Event' | 'Listener' | 'Middleware' | 'Resource' | 'Task', ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, BaseElementFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
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
  emitterId: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emitterResolved: Resolver<Maybe<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  eventId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  eventResolved: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType>;
  payload: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ErrorEntryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['ErrorEntry'] = ResolversParentTypes['ErrorEntry']> = ResolversObject<{
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
  emittedByResolved: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, EventFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  listenedToBy: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  listenedToByResolved: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GlobalMiddlewareResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['GlobalMiddleware'] = ResolversParentTypes['GlobalMiddleware']> = ResolversObject<{
  enabled: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resources: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  tasks: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ListenerResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Listener'] = ResolversParentTypes['Listener']> = ResolversObject<{
  dependsOn: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  depenendsOnResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  emitsResolved: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  event: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, ListenerFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  listenerOrder: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LiveResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Live'] = ResolversParentTypes['Live']> = ResolversObject<{
  emissions: Resolver<Array<ResolversTypes['EmissionEntry']>, ParentType, ContextType, LiveEmissionsArgs>;
  errors: Resolver<Array<ResolversTypes['ErrorEntry']>, ParentType, ContextType, LiveErrorsArgs>;
  logs: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType, LiveLogsArgs>;
  runs: Resolver<Array<ResolversTypes['RunRecord']>, ParentType, ContextType, LiveRunsArgs>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LogEntryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['LogEntry'] = ResolversParentTypes['LogEntry']> = ResolversObject<{
  data: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  level: Resolver<ResolversTypes['LogLevelEnum'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
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
  usedByResources: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  usedByResourcesDetailed: Resolver<Array<ResolversTypes['MiddlewareResourceUsage']>, ParentType, ContextType>;
  usedByResourcesResolved: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  usedByTasks: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  usedByTasksDetailed: Resolver<Array<ResolversTypes['MiddlewareTaskUsage']>, ParentType, ContextType>;
  usedByTasksResolved: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MiddlewareResourceUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MiddlewareResourceUsage'] = ResolversParentTypes['MiddlewareResourceUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['Resource'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MiddlewareTaskUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['MiddlewareTaskUsage'] = ResolversParentTypes['MiddlewareTaskUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['TaskInterface'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  all: Resolver<Array<ResolversTypes['All']>, ParentType, ContextType>;
  diagnostics: Resolver<Array<ResolversTypes['Diagnostic']>, ParentType, ContextType>;
  event: Resolver<Maybe<ResolversTypes['Event']>, ParentType, ContextType, RequireFields<QueryEventArgs, 'id'>>;
  events: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType, QueryEventsArgs>;
  listeners: Resolver<Array<ResolversTypes['Listener']>, ParentType, ContextType, QueryListenersArgs>;
  live: Resolver<ResolversTypes['Live'], ParentType, ContextType>;
  middleware: Resolver<Maybe<ResolversTypes['Middleware']>, ParentType, ContextType, RequireFields<QueryMiddlewareArgs, 'id'>>;
  middlewares: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType, QueryMiddlewaresArgs>;
  resource: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType, RequireFields<QueryResourceArgs, 'id'>>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType, QueryResourcesArgs>;
  root: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  task: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryTaskArgs, 'id'>>;
  tasks: Resolver<Array<ResolversTypes['Task']>, ParentType, ContextType, QueryTasksArgs>;
}>;

export type ResourceResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['Resource'] = ResolversParentTypes['Resource']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  context: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, ResourceFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overrides: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  overridesResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  registers: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  registersResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  usedBy: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RunRecordResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['RunRecord'] = ResolversParentTypes['RunRecord']> = ResolversObject<{
  durationMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nodeId: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nodeKind: Resolver<ResolversTypes['NodeKindEnum'], ParentType, ContextType>;
  nodeResolved: Resolver<Maybe<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  ok: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  timestampMs: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
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
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskDependsOnResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskDependsOn'] = ResolversParentTypes['TaskDependsOn']> = ResolversObject<{
  emitters: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  listeners: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  resources: Resolver<Array<ResolversTypes['Resource']>, ParentType, ContextType>;
  tasks: Resolver<Array<ResolversTypes['TaskInterface']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TaskInterfaceResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskInterface'] = ResolversParentTypes['TaskInterface']> = ResolversObject<{
  __resolveType: TypeResolveFn<'Listener' | 'Task', ParentType, ContextType>;
  dependsOn: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  depenendsOnResolved: Resolver<Array<ResolversTypes['BaseElement']>, ParentType, ContextType>;
  emits: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  emitsResolved: Resolver<Array<ResolversTypes['Event']>, ParentType, ContextType>;
  fileContents: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, TaskInterfaceFileContentsArgs>;
  filePath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  markdownDescription: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  meta: Resolver<Maybe<ResolversTypes['Meta']>, ParentType, ContextType>;
  middleware: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  middlewareResolved: Resolver<Array<ResolversTypes['Middleware']>, ParentType, ContextType>;
  middlewareResolvedDetailed: Resolver<Array<ResolversTypes['TaskMiddlewareUsage']>, ParentType, ContextType>;
  overriddenBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredBy: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  registeredByResolved: Resolver<Maybe<ResolversTypes['Resource']>, ParentType, ContextType>;
}>;

export type TaskMiddlewareUsageResolvers<ContextType = CustomGraphQLContext, ParentType extends ResolversParentTypes['TaskMiddlewareUsage'] = ResolversParentTypes['TaskMiddlewareUsage']> = ResolversObject<{
  config: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  node: Resolver<ResolversTypes['Middleware'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = CustomGraphQLContext> = ResolversObject<{
  All: AllResolvers<ContextType>;
  BaseElement: BaseElementResolvers<ContextType>;
  Diagnostic: DiagnosticResolvers<ContextType>;
  EmissionEntry: EmissionEntryResolvers<ContextType>;
  ErrorEntry: ErrorEntryResolvers<ContextType>;
  Event: EventResolvers<ContextType>;
  GlobalMiddleware: GlobalMiddlewareResolvers<ContextType>;
  Listener: ListenerResolvers<ContextType>;
  Live: LiveResolvers<ContextType>;
  LogEntry: LogEntryResolvers<ContextType>;
  Meta: MetaResolvers<ContextType>;
  MetaTagUsage: MetaTagUsageResolvers<ContextType>;
  Middleware: MiddlewareResolvers<ContextType>;
  MiddlewareResourceUsage: MiddlewareResourceUsageResolvers<ContextType>;
  MiddlewareTaskUsage: MiddlewareTaskUsageResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Resource: ResourceResolvers<ContextType>;
  RunRecord: RunRecordResolvers<ContextType>;
  Task: TaskResolvers<ContextType>;
  TaskDependsOn: TaskDependsOnResolvers<ContextType>;
  TaskInterface: TaskInterfaceResolvers<ContextType>;
  TaskMiddlewareUsage: TaskMiddlewareUsageResolvers<ContextType>;
}>;

