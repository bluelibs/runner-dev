import type {
  ResourceStoreElementType,
  Store,
  TaskStoreElementType,
} from "@bluelibs/runner";
import * as runnerCore from "@bluelibs/runner";
import type { DurableResource } from "@bluelibs/runner/node";
import { hasDurableWorkflowTag } from "./durable.tools";

type StoreSlice = Pick<Store, "tasks" | "resources">;
type DurableResourceConstructor = new (...args: unknown[]) => DurableResource;

let durableResourceConstructor: DurableResourceConstructor | null | undefined;

function resolveDurableResourceConstructor(): DurableResourceConstructor | null {
  if (durableResourceConstructor !== undefined) {
    return durableResourceConstructor;
  }

  try {
    // Keep the node bundle optional at runtime so browser-oriented builds can fall back.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeModule = require("@bluelibs/runner/node") as {
      DurableResource?: DurableResourceConstructor;
    };
    if (nodeModule.DurableResource) {
      durableResourceConstructor = nodeModule.DurableResource;
      return durableResourceConstructor;
    }
  } catch {
    // Fall back to the core bundle below.
  }

  const rootModule = runnerCore as {
    DurableResource?: DurableResourceConstructor;
  };
  if (rootModule.DurableResource) {
    durableResourceConstructor = rootModule.DurableResource;
    return durableResourceConstructor;
  }

  durableResourceConstructor = null;
  return null;
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
