import { isResource, isResourceWithConfig } from "@bluelibs/runner";
import z from "zod";
import type {
  LivePersistence,
  LivePersistenceResource,
  LivePersistenceResourceDefinition,
  LivePersistenceSource,
} from "./persistence";
import { validatePersistenceSnapshot } from "./persistence.schema";
import type { createEntryBuffers } from "./entryBuffers";

function isAdapter(value: unknown): value is LivePersistence {
  return (
    value != null &&
    typeof value === "object" &&
    "load" in value &&
    typeof value.load === "function" &&
    "append" in value &&
    typeof value.append === "function"
  );
}

export function isPersistenceResource(
  value: unknown
): value is LivePersistenceResource {
  return isResource(value) || isResourceWithConfig(value);
}

export const persistenceSourceSchema = z.custom<LivePersistenceSource>(
  (value) => isPersistenceResource(value),
  "persistence must be a Runner resource returning a store with load() and append() methods"
);

export function persistenceResourceDefinition(
  source: LivePersistenceSource | undefined
): LivePersistenceResourceDefinition | undefined {
  if (isResourceWithConfig(source)) return source.resource;
  if (isResource(source)) return source;
  return undefined;
}

export function restorePersistence(
  provider: unknown,
  maxEntries: number,
  buffers: ReturnType<typeof createEntryBuffers>
): { persistence: LivePersistence; lastSequence: number } {
  if (!isAdapter(provider)) {
    throw new Error(
      "Live persistence provider must return a store with load() and append() methods."
    );
  }
  const snapshot = provider.load({ maxEntries });
  validatePersistenceSnapshot(snapshot);
  for (const record of snapshot.entries) buffers.append(record);
  return { persistence: provider, lastSequence: snapshot.lastSequence };
}

/** Reject async implementations without publishing a record before its commit. */
export function commitPersistence(
  persistence: LivePersistence,
  record: Parameters<LivePersistence["append"]>[0],
  maxEntries: number
): void {
  const result: unknown = persistence.append(record, { maxEntries });
  if (
    result != null &&
    (typeof result === "object" || typeof result === "function") &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    // An invalid JS adapter may already have started work. Observe a rejection
    // so the contract error remains the failure callers see.
    void Promise.resolve(result).catch(() => {});
    throw new Error(
      "Live persistence append() must commit synchronously; returning a promise is unsupported."
    );
  }
}
