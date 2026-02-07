import type {
  ResourceStoreElementType,
  Store,
  TaskStoreElementType,
} from "@bluelibs/runner";
import { type DurableFlowShape, DurableResource } from "@bluelibs/runner/node";

type StoreSlice = Pick<Store, "tasks" | "resources">;
type NodeDescribeTask = Parameters<DurableResource["describe"]>[0];

export function hasDurableIdPattern(depId: string): boolean {
  return depId.includes(".durable") || depId.startsWith("base.durable.");
}

function getStoreTask(
  store: StoreSlice | null | undefined,
  taskId: string
): TaskStoreElementType | null {
  return store?.tasks.get(taskId) ?? null;
}

function getDurableDependencyFromTask(
  storeTask: TaskStoreElementType
): DurableResource | null {
  for (const dep of Object.values(storeTask.computedDependencies ?? {})) {
    if (dep instanceof DurableResource) {
      return dep;
    }
  }

  return null;
}

export function getDurableDependencyForTask(
  store: StoreSlice | null | undefined,
  taskId: string
): DurableResource | null {
  const storeTask = getStoreTask(store, taskId);
  if (!storeTask) return null;
  return getDurableDependencyFromTask(storeTask);
}

export async function describeDurableTaskFromStore(
  store: StoreSlice | null | undefined,
  taskId: string
): Promise<DurableFlowShape | null> {
  const storeTask = getStoreTask(store, taskId);
  if (!storeTask) return null;

  const durable = getDurableDependencyFromTask(storeTask);
  if (!durable) return null;

  try {
    // @bluelibs/runner and @bluelibs/runner/node ship separate .d.ts bundles.
    // Their task brands use different `unique symbol`s, so TS treats them as incompatible
    // even though the runtime object is the same task. Cast only at this API boundary.
    return await durable.describe(storeTask.task);
  } catch {
    return null;
  }
}

function getResourceValue(
  store: StoreSlice | null | undefined,
  resourceId: string
): unknown {
  const storeResource = store?.resources.get(resourceId) as
    | ResourceStoreElementType
    | undefined;
  return storeResource?.value;
}

export function findDurableResourceIdFromStore(
  store: StoreSlice | null | undefined,
  taskId: string,
  dependencyIds: string[]
): string | null {
  const durable = getDurableDependencyForTask(store, taskId);
  if (!durable) return null;

  for (const depId of dependencyIds) {
    if (getResourceValue(store, depId) === durable) {
      return depId;
    }
  }

  return null;
}
