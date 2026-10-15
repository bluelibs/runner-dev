import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RunContext = {
  chain: string[];
  correlationId: string;
  /**
   * Set once the run that opened this context has finished. Node hands the
   * store to every handle created inside a run (an HTTP listener opened by a
   * `ready` hook, a timer, a poller), so work that starts later through such
   * a handle still sees it. That work must open its own chain instead of
   * descending from a run that is already over.
   */
  settled?: boolean;
};

export const runContext = new AsyncLocalStorage<RunContext>();

/** The context of a run that is still executing, if the current flow belongs to one. */
export function getCurrentRunContext(): RunContext | undefined {
  const store = runContext.getStore();
  return store && !store.settled ? store : undefined;
}

export function getCorrelationId(): string | null {
  return getCurrentRunContext()?.correlationId ?? null;
}

export function deriveParentAndRoot(taskId: string): {
  parentId: string | null;
  rootId: string;
} {
  const prevChain = getCurrentRunContext()?.chain ?? [];
  const parentId =
    prevChain.length > 0 ? prevChain[prevChain.length - 1] : null;
  const rootId = prevChain.length > 0 ? prevChain[0] : taskId;
  return { parentId, rootId };
}

export async function withTaskRunContext<T>(
  taskId: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const store = getCurrentRunContext();
  const correlationId = store?.correlationId ?? randomUUID();
  const nextStore: RunContext = {
    chain: [...(store?.chain ?? []), taskId],
    correlationId,
    settled: false,
  };
  try {
    return await runContext.run(nextStore, async () => fn());
  } finally {
    nextStore.settled = true;
  }
}
