import type { AnyTask, IEventDefinition, Store } from "@bluelibs/runner";
import z from "zod";
import { isEvent } from "@bluelibs/runner";
import { DurableResource, durableWorkflowTag } from "@bluelibs/runner/node";
import { getDurableDependencyForTask } from "../resources/models/durable.runtime";
import type { StudioWorkflow } from "./shared/types";
import type { DurableRuntimeDescriptor } from "./shared/runtime";
import { DurableHttpError, requireValue } from "./errors";

export interface DashboardRuntime {
  descriptor: DurableRuntimeDescriptor;
  durable: DurableResource;
  workflows: Map<string, AnyTask>;
  store: Store;
}

/** Discover initialized application runtimes; the dashboard owns no workers. */
export function discoverRuntimes(store: Store): DashboardRuntime[] {
  const runtimes: DashboardRuntime[] = [];
  for (const [id, entry] of store.resources) {
    const value: unknown = entry.value;
    if (!(value instanceof DurableResource)) continue;
    // A resource can expose the same runtime more than once. Prefer its first owner.
    if (runtimes.some((runtime) => runtime.durable === value)) continue;
    const workflows = new Map<string, AnyTask>();
    for (const [taskId, taskEntry] of store.tasks) {
      if (getDurableDependencyForTask(store, taskId) !== value) continue;
      const config = durableWorkflowTag.extract(taskEntry.task.tags ?? []);
      const key = config?.key ?? taskId;
      if (workflows.has(key)) {
        throw new Error(`Duplicate durable workflow key '${key}' in '${id}'.`);
      }
      workflows.set(key, taskEntry.task);
    }
    runtimes.push({
      durable: value,
      store,
      workflows,
      descriptor: {
        id,
        title: entry.resource.meta?.title ?? id,
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
  key: string
): AnyTask {
  return requireValue(
    runtime.workflows.get(key),
    `Unknown workflow '${key}' in '${runtime.descriptor.id}'.`
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

export function workflowCatalog(runtime: DashboardRuntime): StudioWorkflow[] {
  return [...runtime.workflows].map(([key, task]) => {
    const config = durableWorkflowTag.extract(task.tags ?? []);
    const metadata =
      config?.metadata?.studio === undefined
        ? { presets: [] }
        : studioMetadata.parse(config.metadata.studio);
    return {
      key,
      taskId: task.id,
      title: task.meta?.title ?? key,
      category: config?.category ?? "workflows",
      description: task.meta?.description ?? "",
      signals: (config?.signals ?? []).map((signal) => {
        const event = resolveSignal(runtime, task, signal.id);
        return {
          id: signal.id,
          title: event.meta?.title ?? signal.id,
          description: event.meta?.description ?? "",
          presets: [],
        };
      }),
      presets: metadata.presets.map((preset) => ({
        name: preset.name,
        payload: preset.payload,
      })),
      graph: { nodes: [], edges: [] },
    };
  });
}
