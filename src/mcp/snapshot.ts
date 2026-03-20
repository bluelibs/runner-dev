import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultFieldResolver,
  defaultTypeResolver,
  graphql,
  type ExecutionResult,
  type GraphQLFieldResolver,
  type GraphQLResolveInfo,
  type GraphQLSchema,
} from "graphql";
import type { DocsPagePayload } from "../resources/docsPayload";
import { createRunnerDevGraphqlSchema } from "../resources/graphql-accumulator.resource";
import type { CoverageService } from "../resources/coverage.resource";
import type {
  EmissionEntry,
  ErrorEntry,
  Live,
  LogEntry,
  RunRecord,
} from "../resources/live.resource";
import { Introspector } from "../resources/models/Introspector";
import { isSystemEventId } from "../resources/models/introspector.tools";
import type { ISwapManager } from "../resources/swap.resource";
import { convertJsonSchemaToReadable } from "../utils/schemaFormat";
import { isSystemNamespaceId } from "../utils/system-namespace";

type SnapshotRuntime = {
  absolutePath: string;
  statKey: string;
  payload: DocsPagePayload;
  schema: GraphQLSchema;
  introspector: Introspector;
  rootValue: Record<string, unknown>;
  fieldResolver: GraphQLFieldResolver<unknown, unknown>;
  typeResolver: SnapshotTypeResolver;
};

type SnapshotTypeResolver = (
  source: unknown,
  contextValue: unknown,
  info: GraphQLResolveInfo,
  abstractType: unknown
) => Promise<string | undefined> | string | undefined;

const snapshotLiveStub: Live = {
  getLogs(): LogEntry[] {
    return [];
  },
  getEmissions(): EmissionEntry[] {
    return [];
  },
  getErrors(): ErrorEntry[] {
    return [];
  },
  getRuns(): RunRecord[] {
    return [];
  },
  recordLog() {},
  recordEmission() {},
  recordError() {},
  recordRun() {},
  async describeFlow() {
    return null;
  },
  onRecord() {
    return () => {};
  },
};

const snapshotSwapManagerStub: ISwapManager = {
  async swap(taskId: string) {
    return { success: false, error: "Swap unavailable for snapshots", taskId };
  },
  async unswap(taskId: string) {
    return {
      success: false,
      error: "Unswap unavailable for snapshots",
      taskId,
    };
  },
  async unswapAll() {
    return [];
  },
  getSwappedTasks() {
    return [];
  },
  isSwapped() {
    return false;
  },
  async invokeTask(taskId: string) {
    return {
      success: false,
      error: `invokeTask unavailable for snapshots (${taskId})`,
      taskId,
    };
  },
  async invokeEvent(eventId: string) {
    return {
      success: false,
      error: `invokeEvent unavailable for snapshots (${eventId})`,
      eventId,
    } as any;
  },
  async runnerEval() {
    return {
      success: false,
      error: "runnerEval unavailable for snapshots",
    } as any;
  },
};

const snapshotCoverageStub: CoverageService = {
  async getRawCoverageContents() {
    return null;
  },
  async getSummaryForAbsolutePath() {
    return null;
  },
  async getDetailsForAbsolutePath() {
    return null;
  },
  async getSummaryForPath() {
    return null;
  },
  async getDetailsForPath() {
    return null;
  },
};

let cachedSnapshotRuntime:
  | {
      sourcePath: string;
      statKey: string;
      runtime: Promise<SnapshotRuntime>;
    }
  | undefined;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function filterByIdIncludes<T extends { id?: string | null }>(
  items: T[],
  idIncludes?: string | null
): T[] {
  if (!idIncludes || idIncludes.trim().length === 0) {
    return items;
  }

  return items.filter((item) => String(item?.id || "").includes(idIncludes));
}

function normalizeSnapshotPath(snapshotFile: string): string {
  return path.isAbsolute(snapshotFile)
    ? snapshotFile
    : path.resolve(process.cwd(), snapshotFile);
}

function createSnapshotStatKey(stat: {
  mtimeMs: number;
  size: number;
}): string {
  return `${stat.mtimeMs}:${stat.size}`;
}

function getSchemaSourceFieldName(
  fieldName: string
): "inputSchema" | "configSchema" | "payloadSchema" | null {
  switch (fieldName) {
    case "inputSchemaReadable":
      return "inputSchema";
    case "configSchemaReadable":
      return "configSchema";
    case "payloadSchemaReadable":
      return "payloadSchema";
    default:
      return null;
  }
}

function inferSnapshotTypeName(source: unknown): string {
  const value = source as Record<string, unknown> | null;

  if (!value || typeof value !== "object") {
    return "All";
  }

  if (Array.isArray(value.targets)) {
    return "Tag";
  }

  if (
    Array.isArray(value.usedBy) ||
    Array.isArray(value.requiredBy) ||
    Array.isArray(value.providedBy)
  ) {
    return "AsyncContext";
  }

  if (Array.isArray(value.registers) && Array.isArray(value.overrides)) {
    return "Resource";
  }

  if (
    Array.isArray(value.usedByTasks) ||
    Array.isArray(value.usedByResources)
  ) {
    const usedByTasks = Array.isArray(value.usedByTasks)
      ? value.usedByTasks
      : [];
    const usedByResources = Array.isArray(value.usedByResources)
      ? value.usedByResources
      : [];

    if (usedByTasks.length > 0 || usedByResources.length === 0) {
      return "TaskMiddleware";
    }

    return "ResourceMiddleware";
  }

  if (Array.isArray(value.listenedToBy)) {
    return "Event";
  }

  if (Array.isArray(value.events)) {
    return "Hook";
  }

  if (Array.isArray(value.emits) && Array.isArray(value.dependsOn)) {
    return "Task";
  }

  if (Array.isArray(value.thrownBy) || typeof value.dataSchema === "string") {
    return "Error";
  }

  return "All";
}

function createSnapshotTypeResolver(): SnapshotTypeResolver {
  return async (source, contextValue, info, abstractType) => {
    const inferredTypeName = inferSnapshotTypeName(source);
    if (inferredTypeName !== "All") {
      return inferredTypeName;
    }

    const fallback = await defaultTypeResolver(
      source as any,
      contextValue as any,
      info,
      abstractType as any
    );

    return typeof fallback === "string" ? fallback : undefined;
  };
}

function createSnapshotFieldResolver(): GraphQLFieldResolver<unknown, unknown> {
  return async (
    source: unknown,
    args: Record<string, unknown>,
    contextValue: unknown,
    info: GraphQLResolveInfo
  ) => {
    const introspector =
      contextValue &&
      typeof contextValue === "object" &&
      "introspector" in (contextValue as Record<string, unknown>)
        ? (contextValue as { introspector: Introspector }).introspector
        : null;

    if (
      info.fieldName === "emittedBy" &&
      introspector &&
      typeof (source as Record<string, unknown> | null)?.id === "string"
    ) {
      return (
        introspector.getEmittersOfEvent(
          String((source as Record<string, unknown>).id)
        ) || []
      ).map((node) => node.id);
    }

    const resolved = await defaultFieldResolver(
      source,
      args,
      contextValue,
      info
    );

    if (resolved != null) {
      return resolved;
    }

    const schemaSourceFieldName = getSchemaSourceFieldName(info.fieldName);
    if (schemaSourceFieldName) {
      const schemaSource = (source as Record<string, unknown> | null)?.[
        schemaSourceFieldName
      ];

      if (typeof schemaSource === "string" && schemaSource.trim().length > 0) {
        return convertJsonSchemaToReadable(schemaSource);
      }
    }

    if (
      info.fieldName === "emittedByResolved" &&
      introspector &&
      typeof (source as Record<string, unknown> | null)?.id === "string"
    ) {
      return introspector.getEmittersOfEvent(
        String((source as Record<string, unknown>).id)
      );
    }

    if (
      info.fieldName === "listenedToByResolved" &&
      introspector &&
      typeof (source as Record<string, unknown> | null)?.id === "string"
    ) {
      return introspector.getHooksOfEvent(
        String((source as Record<string, unknown>).id)
      );
    }

    if (
      info.fieldName === "registeredByResolved" &&
      introspector &&
      typeof (source as Record<string, unknown> | null)?.registeredBy ===
        "string"
    ) {
      return introspector.getResource(
        String((source as Record<string, unknown>).registeredBy)
      );
    }

    return resolved;
  };
}

async function loadSnapshotRuntime(
  snapshotFile: string
): Promise<SnapshotRuntime> {
  const absolutePath = normalizeSnapshotPath(snapshotFile);
  const stat = await fs.stat(absolutePath);
  const statKey = createSnapshotStatKey(stat);
  const raw = await fs.readFile(absolutePath, "utf8");
  const payload = JSON.parse(raw) as DocsPagePayload;

  if (!payload || typeof payload !== "object") {
    throw new Error(`Snapshot file is invalid: ${absolutePath}`);
  }

  if (!payload.introspectorData) {
    throw new Error(
      `Snapshot file is missing introspectorData: ${absolutePath}`
    );
  }

  if (!payload.graphqlSdl || payload.graphqlSdl.trim().length === 0) {
    throw new Error(
      `Snapshot file is missing graphqlSdl. Re-export the catalog with a current runner-dev version: ${absolutePath}`
    );
  }

  const introspector = Introspector.deserialize(payload.introspectorData);
  const rootValue = {
    __typename: "Query",
    all: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(
        [
          ...introspector.getTasks(),
          ...introspector.getHooks(),
          ...introspector.getResources(),
          ...introspector.getMiddlewares(),
          ...introspector.getEvents(),
          ...introspector.getAllTags(),
        ],
        idIncludes
      ),
    tags: () => introspector.getAllTags(),
    tag: ({ id }: { id: string }) => introspector.getTag(id),
    root: () => introspector.getRoot(),
    runOptions: () => introspector.getRunOptions(),
    interceptorOwners: () => introspector.getInterceptorOwnersSnapshot(),
    event: ({ id }: { id: string }) => introspector.getEvent(id),
    events: ({
      filter,
    }: {
      filter?: {
        hideSystem?: boolean;
        hasNoHooks?: boolean;
        idIncludes?: string;
      };
    } = {}) => {
      let result = introspector.getEvents();
      if (filter?.hideSystem) {
        result = result.filter(
          (event) =>
            event.id !== "dev" &&
            !event.id.startsWith("dev.") &&
            !event.id.includes(".dev.") &&
            !isSystemNamespaceId(event.id) &&
            !isSystemEventId(event.id)
        );
      }
      if (filter?.idIncludes) {
        result = filterByIdIncludes(result, filter.idIncludes);
      }
      if (typeof filter?.hasNoHooks === "boolean") {
        result = result.filter((event) => {
          const specificHooks = introspector.getHooksOfEvent(event.id).length;
          return filter.hasNoHooks ? specificHooks === 0 : specificHooks > 0;
        });
      }
      return result;
    },
    task: ({ id }: { id: string }) => introspector.getTask(id),
    tasks: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getTasks(), idIncludes),
    hook: ({ id }: { id: string }) => introspector.getHook(id),
    hooks: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getHooks(), idIncludes),
    middleware: ({ id }: { id: string }) => introspector.getMiddleware(id),
    middlewares: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getMiddlewares(), idIncludes),
    taskMiddlewares: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getTaskMiddlewares(), idIncludes),
    resourceMiddlewares: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getResourceMiddlewares(), idIncludes),
    resource: ({ id }: { id: string }) => introspector.getResource(id),
    resources: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getResources(), idIncludes),
    error: ({ id }: { id: string }) => introspector.getError(id),
    errors: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getErrors(), idIncludes),
    asyncContext: ({ id }: { id: string }) => introspector.getAsyncContext(id),
    asyncContexts: ({ idIncludes }: { idIncludes?: string } = {}) =>
      filterByIdIncludes(introspector.getAsyncContexts(), idIncludes),
    diagnostics: () => asArray(payload.introspectorData.diagnostics),
    live: () => ({
      logs: () => [],
      emissions: () => [],
      errors: () => [],
      runs: () => [],
      stats: null,
      health: null,
    }),
    swappedTasks: () => [],
  } satisfies Record<string, unknown>;

  return {
    absolutePath,
    statKey,
    payload,
    schema: createRunnerDevGraphqlSchema(),
    introspector,
    rootValue,
    fieldResolver: createSnapshotFieldResolver(),
    typeResolver: createSnapshotTypeResolver(),
  };
}

export async function getSnapshotRuntime(
  snapshotFile: string
): Promise<SnapshotRuntime> {
  const absolutePath = normalizeSnapshotPath(snapshotFile);
  const stat = await fs.stat(absolutePath);
  const statKey = createSnapshotStatKey(stat);

  if (
    cachedSnapshotRuntime?.sourcePath === absolutePath &&
    cachedSnapshotRuntime.statKey === statKey
  ) {
    return cachedSnapshotRuntime.runtime;
  }

  const runtimePromise = loadSnapshotRuntime(absolutePath);
  cachedSnapshotRuntime = {
    sourcePath: absolutePath,
    statKey,
    runtime: runtimePromise,
  };

  try {
    return await runtimePromise;
  } catch (error) {
    if (cachedSnapshotRuntime?.sourcePath === absolutePath) {
      cachedSnapshotRuntime = undefined;
    }
    throw error;
  }
}

export async function callSnapshotGraphQL(params: {
  snapshotFile: string;
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}): Promise<ExecutionResult> {
  const runtime = await getSnapshotRuntime(params.snapshotFile);
  return graphql({
    schema: runtime.schema,
    source: params.query,
    rootValue: runtime.rootValue,
    contextValue: {
      store: (runtime.introspector.store ?? {}) as any,
      logger: console,
      introspector: runtime.introspector,
      live: snapshotLiveStub,
      swapManager: snapshotSwapManagerStub,
      coverage: snapshotCoverageStub as any,
    },
    fieldResolver: runtime.fieldResolver,
    typeResolver: runtime.typeResolver,
    variableValues: params.variables,
    operationName: params.operationName,
  });
}
