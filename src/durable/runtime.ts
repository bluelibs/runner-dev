import type { AnyTask, IEventDefinition, Store } from "@bluelibs/runner";
import z from "zod";
import { isEvent } from "@bluelibs/runner";
import {
  DurableResource,
  MemoryStore,
  PersistentMemoryStore,
  PostgresStore,
  RedisStore,
  SqliteStore,
  durableWorkflowTag,
  type DurableOperator,
  type DurableWorkflowConcurrency,
  type IDurableStore,
} from "@bluelibs/runner/node";
import { getDurableDependencyForTask } from "../resources/models/durable.runtime";
import type {
  StudioCommand,
  StudioWorkflow,
  StudioWorkflowVersion,
} from "./shared/types";
import type {
  DurableRuntimeBackend,
  DurableRuntimeDescriptor,
} from "./shared/runtime";
import { DurableHttpError, requireValue } from "./errors";
import { formatRetention } from "./projection";

export interface DashboardWorkflowVersion {
  version?: number;
  task: AnyTask;
}

export interface DashboardRuntime {
  descriptor: DurableRuntimeDescriptor;
  durable: DurableResource;
  workflows: Map<string, AnyTask>;
  workflowVersions?: Map<string, DashboardWorkflowVersion[]>;
  store: Store;
}

/** Safely reads the runtime's backing store; returns undefined when unprovided. */
export function getBackingStore(
  durable: DurableResource
): IDurableStore | undefined {
  try {
    return typeof durable.getStore === "function"
      ? durable.getStore()
      : undefined;
  } catch {
    return undefined;
  }
}

export function safeGetOperator(
  durable: DurableResource
): DurableOperator | undefined {
  try {
    return durable.operator;
  } catch {
    return undefined;
  }
}

function detectBackend(
  store: IDurableStore | undefined
): DurableRuntimeBackend {
  if (!store) return "custom";
  if (typeof SqliteStore === "function" && store instanceof SqliteStore)
    return "sqlite";
  if (typeof PostgresStore === "function" && store instanceof PostgresStore)
    return "postgres";
  if (typeof RedisStore === "function" && store instanceof RedisStore)
    return "redis";
  if (
    typeof PersistentMemoryStore === "function" &&
    store instanceof PersistentMemoryStore
  )
    return "persistent-memory";
  if (typeof MemoryStore === "function" && store instanceof MemoryStore)
    return "memory";
  return "custom";
}

function sortWorkflowVersions(
  versions: DashboardWorkflowVersion[]
): DashboardWorkflowVersion[] {
  return [...versions].sort((left, right) => {
    if (left.version === undefined && right.version === undefined) return 0;
    if (left.version === undefined) return 1;
    if (right.version === undefined) return -1;
    return right.version - left.version;
  });
}

/** Discover initialized application runtimes; the dashboard owns no workers. */
export function discoverRuntimes(store: Store): DashboardRuntime[] {
  const runtimes: DashboardRuntime[] = [];
  for (const [id, entry] of store.resources) {
    const value: unknown = entry.value;
    if (!(value instanceof DurableResource)) continue;
    // A resource can expose the same runtime more than once. Prefer its first owner.
    if (runtimes.some((runtime) => runtime.durable === value)) continue;
    const versionsByKey = new Map<string, DashboardWorkflowVersion[]>();
    const seenKeyVersions = new Set<string>();
    for (const [taskId, taskEntry] of store.tasks) {
      if (getDurableDependencyForTask(store, taskId) !== value) continue;
      const config = durableWorkflowTag.extract(taskEntry.task.tags ?? []);
      const key = config?.key ?? taskId;
      const version = config?.version;
      const versionKey = JSON.stringify([key, version ?? null]);
      if (seenKeyVersions.has(versionKey)) {
        throw new Error(`Duplicate durable workflow key '${key}' in '${id}'.`);
      }
      seenKeyVersions.add(versionKey);
      const list = versionsByKey.get(key) ?? [];
      list.push({ version, task: taskEntry.task });
      versionsByKey.set(key, list);
    }
    const workflows = new Map<string, AnyTask>();
    const workflowVersions = new Map<string, DashboardWorkflowVersion[]>();
    for (const [key, versions] of versionsByKey) {
      const sorted = sortWorkflowVersions(versions);
      workflowVersions.set(key, sorted);
      workflows.set(key, sorted[0].task);
    }
    const backingStore = getBackingStore(value);
    const operator = safeGetOperator(value);
    runtimes.push({
      durable: value,
      store,
      workflows,
      workflowVersions,
      descriptor: {
        id,
        title: entry.resource.meta?.title ?? id,
        backend: detectBackend(backingStore),
        capabilities: {
          pause:
            "pauseExecution" in value &&
            typeof value.pauseExecution === "function",
          resume:
            "resumeExecution" in value &&
            typeof value.resumeExecution === "function",
          restart:
            "restartExecution" in value &&
            typeof value.restartExecution === "function",
          state: "getState" in value && typeof value.getState === "function",
          command:
            "command" in value &&
            typeof value.command === "function" &&
            Boolean(
              backingStore?.enqueueCommand && backingStore?.completeCommand
            ),
          reset:
            typeof operator?.reset === "function" &&
            Boolean(
              backingStore?.createCheckpointExecution &&
                backingStore?.listExecutionHistory
            ),
          replay:
            typeof operator?.exportReplay === "function" &&
            Boolean(backingStore?.listExecutionHistory),
        },
      },
    });
  }
  return runtimes;
}

export function selectRuntime(store: Store, id?: string): DashboardRuntime {
  const runtimes = discoverRuntimes(store);
  if (id)
    return requireValue(
      runtimes.find((runtime) => runtime.descriptor.id === id),
      `Unknown durable runtime '${id}'.`
    );
  if (runtimes.length === 1) return runtimes[0];
  throw new DurableHttpError(
    runtimes.length === 0 ? 404 : 400,
    runtimes.length === 0
      ? "This application has no durable runtime."
      : "Select a runtime with 'runtimeId'."
  );
}

export function requireWorkflow(
  runtime: DashboardRuntime,
  key: string,
  version?: number | null
): AnyTask {
  if (version === undefined) {
    return requireValue(
      runtime.workflows.get(key),
      `Unknown workflow '${key}' in '${runtime.descriptor.id}'.`
    );
  }
  const versions = runtime.workflowVersions?.get(key);
  const match = versions?.find((entry) =>
    version === null ? entry.version === undefined : entry.version === version
  );
  const label =
    version === null ? `${key} (unversioned)` : `${key} v${version}`;
  return requireValue(
    match?.task,
    `Unknown workflow '${label}' in '${runtime.descriptor.id}'.`
  );
}

/** Resolves the exact task registered for an existing execution's key and version. */
export function findWorkflowForExecution(
  runtime: DashboardRuntime,
  workflowKey: string,
  workflowVersion?: number
): AnyTask | undefined {
  const versions = runtime.workflowVersions?.get(workflowKey);
  if (versions) {
    return versions.find((entry) => entry.version === workflowVersion)?.task;
  }
  return runtime.workflows.get(workflowKey);
}

function resolveRegisteredTask(
  runtime: DashboardRuntime,
  task: AnyTask
): AnyTask {
  try {
    return runtime.store.resolveRegisteredDefinition(task);
  } catch {
    return task;
  }
}

export function resolveCommand(
  runtime: DashboardRuntime,
  task: AnyTask,
  commandTaskKey: string
): AnyTask {
  const declared = durableWorkflowTag.extract(task.tags ?? [])?.commands ?? [];
  for (const command of declared) {
    const resolved = resolveRegisteredTask(runtime, command);
    if (resolved.id === commandTaskKey || command.id === commandTaskKey) {
      return resolved;
    }
  }
  throw new DurableHttpError(
    400,
    `Command '${commandTaskKey}' is not declared by this workflow version.`
  );
}

/** Resolve real registered signal contracts, retaining schema and source identity. */
export function resolveSignal(
  runtime: DashboardRuntime,
  task: AnyTask,
  id: string
): IEventDefinition<unknown> {
  const declared = durableWorkflowTag.extract(task.tags ?? [])?.signals;
  if (declared && !declared.some((signal) => signal.id === id)) {
    throw new DurableHttpError(
      400,
      `Signal '${id}' is not declared by this workflow.`
    );
  }
  const declaredSignal = declared?.find((signal) => signal.id === id);
  if (isEvent(declaredSignal)) {
    const registered =
      runtime.store.resolveRegisteredDefinition(declaredSignal);
    return { ...registered, id: declaredSignal.id };
  }
  const matches = [...runtime.store.events.entries()].filter(
    ([canonicalId, entry]) =>
      entry.event.id === id ||
      runtime.store.getDefinitionSourceIds(canonicalId).includes(id)
  );
  if (matches.length !== 1) {
    throw new DurableHttpError(
      400,
      `Signal '${id}' must identify one registered event.`
    );
  }
  const event = matches[0][1].event;
  // Durable journals use the declared local signal ID rather than canonical addressing.
  return { ...event, id };
}

const studioMetadata = z
  .object({
    presets: z
      .array(z.object({ name: z.string().min(1), payload: z.unknown() }))
      .default([]),
  })
  .passthrough();

function extractPresets(task: AnyTask) {
  const config = durableWorkflowTag.extract(task.tags ?? []);
  const metadata =
    config?.metadata?.studio === undefined
      ? { presets: [] }
      : studioMetadata.parse(config.metadata.studio);
  return metadata.presets.map((preset) => ({
    name: preset.name,
    payload: preset.payload,
  }));
}

function extractSignals(runtime: DashboardRuntime, task: AnyTask) {
  const config = durableWorkflowTag.extract(task.tags ?? []);
  return (config?.signals ?? []).map((signal) => {
    const event = resolveSignal(runtime, task, signal.id);
    return {
      id: signal.id,
      title: event.meta?.title ?? signal.id,
      description: event.meta?.description ?? "",
      presets: [],
    };
  });
}

function extractCommands(
  runtime: DashboardRuntime,
  task: AnyTask
): StudioCommand[] {
  const config = durableWorkflowTag.extract(task.tags ?? []);
  return (config?.commands ?? []).map((command) => {
    const resolved = resolveRegisteredTask(runtime, command);
    return {
      taskKey: resolved.id,
      title: resolved.meta?.title ?? command.meta?.title ?? resolved.id,
      description:
        resolved.meta?.description ?? command.meta?.description ?? "",
    };
  });
}

function formatWindow(windowMs: number): string {
  if (windowMs % 3_600_000 === 0) return `${windowMs / 3_600_000}h`;
  if (windowMs % 60_000 === 0) return `${windowMs / 60_000}m`;
  if (windowMs % 1000 === 0) return `${windowMs / 1000}s`;
  return `${windowMs}ms`;
}

function formatConcurrency(
  concurrency: DurableWorkflowConcurrency | undefined
): string | undefined {
  if (concurrency === undefined) return undefined;
  if (typeof concurrency === "number") return `max ${concurrency} concurrent`;
  return `${concurrency.max} / ${formatWindow(concurrency.windowMs)}`;
}

export function workflowCatalog(runtime: DashboardRuntime): StudioWorkflow[] {
  return [...runtime.workflows].map(([key, task]) => {
    const config = durableWorkflowTag.extract(task.tags ?? []);
    const rawVersions = runtime.workflowVersions?.get(key) ?? [
      { version: config?.version, task },
    ];
    const versions: StudioWorkflowVersion[] = rawVersions.map((entry) => ({
      version: entry.version ?? null,
      taskId: entry.task.id,
      title: entry.task.meta?.title ?? key,
      description: entry.task.meta?.description ?? "",
      signals: extractSignals(runtime, entry.task),
      commands: extractCommands(runtime, entry.task),
      presets: extractPresets(entry.task),
    }));
    const primary = versions[0];
    const retention = formatRetention(config?.retention) ?? undefined;
    const concurrency = formatConcurrency(config?.concurrency);
    return {
      key,
      taskId: task.id,
      title: primary.title,
      category: config?.category ?? "workflows",
      description: primary.description,
      ...(config?.version !== undefined ? { version: config.version } : {}),
      versions,
      signals: primary.signals,
      ...(primary.commands.length > 0 ? { commands: primary.commands } : {}),
      ...(retention ? { retention } : {}),
      ...(concurrency ? { concurrency } : {}),
      presets: primary.presets,
      graph: { nodes: [], edges: [] },
    };
  });
}
