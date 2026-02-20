import type {
  ResourceStoreElementType,
  Store,
  TaskStoreElementType,
} from "@bluelibs/runner";
import type { DurableFlowShape, DurableResource } from "@bluelibs/runner/node";
import { hasDurableWorkflowTag } from "./durable.tools";

type StoreSlice = Pick<Store, "tasks" | "resources">;
type DurableResourceConstructor = new (...args: unknown[]) => DurableResource;

interface DescribeDurableTaskOptions {
  timeoutMs?: number;
}

let durableResourceConstructor: DurableResourceConstructor | null | undefined;

function resolveDurableResourceConstructor():
  | DurableResourceConstructor
  | null {
  if (durableResourceConstructor !== undefined) {
    return durableResourceConstructor;
  }

  try {
    const nodeModule = require("@bluelibs/runner/node") as {
      DurableResource?: DurableResourceConstructor;
    };
    durableResourceConstructor = nodeModule.DurableResource ?? null;
    return durableResourceConstructor;
  } catch {
    // Fall through to root import for older package layouts.
  }

  try {
    const rootModule = require("@bluelibs/runner") as {
      DurableResource?: DurableResourceConstructor;
    };
    durableResourceConstructor = rootModule.DurableResource ?? null;
    return durableResourceConstructor;
  } catch {
    durableResourceConstructor = null;
    return null;
  }
}

function getStoreTask(
  store: StoreSlice | null | undefined,
  taskId: string
): TaskStoreElementType | null {
  return store?.tasks.get(taskId) ?? null;
}

function isTaggedDurableWorkflow(storeTask: TaskStoreElementType): boolean {
  return hasDurableWorkflowTag((storeTask.task as { tags?: unknown[] }).tags);
}

function getDurableDependencyFromTask(
  storeTask: TaskStoreElementType
): DurableResource | null {
  if (!isTaggedDurableWorkflow(storeTask)) return null;

  const DurableResourceRef = resolveDurableResourceConstructor();
  if (!DurableResourceRef) return null;

  for (const dep of Object.values(storeTask.computedDependencies ?? {})) {
    if (dep instanceof DurableResourceRef) {
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
  taskId: string,
  options: DescribeDurableTaskOptions = {}
): Promise<DurableFlowShape | null> {
  const storeTask = getStoreTask(store, taskId);
  if (!storeTask) return null;

  const durable = getDurableDependencyFromTask(storeTask);
  if (!durable) return null;

  try {
    const describePromise = durable.describe(storeTask.task).catch(() => null);
    const timeoutMs = options.timeoutMs ?? 0;
    if (timeoutMs <= 0) {
      // @bluelibs/runner and @bluelibs/runner/node ship separate .d.ts bundles.
      // Their task brands use different `unique symbol`s, so TS treats them as incompatible
      // even though the runtime object is the same task. Cast only at this API boundary.
      return await describePromise;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), timeoutMs);
    });

    const flowShape = (await Promise.race([
      describePromise,
      timeoutPromise,
    ])) as DurableFlowShape | null;

    if (timeoutId) clearTimeout(timeoutId);
    return flowShape;
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
