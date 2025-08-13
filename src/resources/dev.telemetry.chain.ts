import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RunContext = {
  chain: string[];
  correlationId: string;
};

export const runContext = new AsyncLocalStorage<RunContext>();

export function getCurrentRunContext(): RunContext | undefined {
  return runContext.getStore();
}

export function getCorrelationId(): string | null {
  return runContext.getStore()?.correlationId ?? null;
}

export function deriveParentAndRoot(taskId: string): {
  parentId: string | null;
  rootId: string;
} {
  const store = runContext.getStore();
  const prevChain = store?.chain ?? [];
  const parentId =
    prevChain.length > 0 ? prevChain[prevChain.length - 1] : null;
  const rootId = prevChain.length > 0 ? prevChain[0] : taskId;
  return { parentId, rootId };
}

export async function withTaskRunContext<T>(
  taskId: string,
  fn: () => Promise<T> | T
): Promise<T> {
  const store = runContext.getStore();
  const correlationId = store?.correlationId ?? randomUUID();
  const prevChain = store?.chain ?? [];
  const newChain = [...prevChain, taskId];
  const nextStore: RunContext = { chain: newChain, correlationId };
  return await runContext.run(nextStore, async () => fn());
}
