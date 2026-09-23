import { definitions, middleware, type Store } from "@bluelibs/runner";
import type { MiddlewareUsage } from "../../schema/model";
import { stringifyIfObject } from "./introspector.tools";

export type SubtreePolicyInput = {
  tasks?: {
    middleware?: unknown;
    identity?: unknown;
    validate?: unknown;
  } | null;
  middleware?: { identityScope?: unknown } | null;
  resources?: { middleware?: unknown; validate?: unknown } | null;
  hooks?: { validate?: unknown } | null;
  taskMiddleware?: { validate?: unknown } | null;
  resourceMiddleware?: { validate?: unknown } | null;
  events?: { validate?: unknown } | null;
  tags?: { validate?: unknown } | null;
};

type MiddlewareAttachment = { id: unknown; config?: unknown };

/** Duplicate key -> id of the resource whose subtree policy applied it. */
type SubtreeOwnerIdsByKey = Map<string, string>;

const taskMiddlewareScopeMarker = ".middleware.task.";
const resourceMiddlewareScopeMarker = ".middleware.resource.";

// Runner compares subtree and local middleware by the id tail after the
// scope marker, so a subtree entry declared with a short id still matches
// the canonical (owner-prefixed) id in the effective stack.
function getMiddlewareDuplicateKey(id: string): string {
  const taskScopeIndex = id.lastIndexOf(taskMiddlewareScopeMarker);
  if (taskScopeIndex >= 0) {
    return id.slice(taskScopeIndex + taskMiddlewareScopeMarker.length);
  }

  const resourceScopeIndex = id.lastIndexOf(resourceMiddlewareScopeMarker);
  if (resourceScopeIndex >= 0) {
    return id.slice(resourceScopeIndex + resourceMiddlewareScopeMarker.length);
  }

  return id;
}

function getOwnerResourceChain(
  store: Store,
  nearestOwnerId: string | null | undefined
): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let currentOwnerId = nearestOwnerId;

  while (currentOwnerId && !visited.has(currentOwnerId)) {
    visited.add(currentOwnerId);
    chain.push(currentOwnerId);
    currentOwnerId = store.getOwnerResourceId(currentOwnerId);
  }

  return chain;
}

export function getSubtreePolicies(resource: any): SubtreePolicyInput[] {
  const rawSubtree = resource?.subtree;
  if (!rawSubtree || typeof rawSubtree !== "object") return [];
  return Array.isArray(rawSubtree)
    ? rawSubtree.filter(
        (policy): policy is SubtreePolicyInput =>
          Boolean(policy) && typeof policy === "object"
      )
    : [rawSubtree as SubtreePolicyInput];
}

export function readSubtreeMiddlewareEntryId(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  if ("use" in entry) {
    return readSubtreeMiddlewareEntryId(entry.use);
  }

  // An object without a string id is not a middleware reference; reading it
  // as one would invent an "[object Object]" id.
  return "id" in entry && typeof entry.id === "string" ? entry.id : null;
}

function passesSubtreeCondition(entry: object, target: unknown): boolean {
  const when = "when" in entry ? entry.when : undefined;
  if (typeof when !== "function") return true;
  try {
    return Boolean(when(target));
  } catch {
    // A throwing predicate cannot have applied the middleware for this
    // target, so it is treated as not matching instead of aborting init.
    return false;
  }
}

function resolveSubtreeMiddlewareEntry(
  entry: unknown,
  target: unknown
): string | null {
  if (!entry || typeof entry !== "object" || !("use" in entry)) {
    return readSubtreeMiddlewareEntryId(entry);
  }

  return passesSubtreeCondition(entry, target)
    ? readSubtreeMiddlewareEntryId(entry.use)
    : null;
}

/**
 * Mirrors Runner's subtree resolution: owners are walked root-first and the
 * first owner contributing a middleware (by duplicate key) owns it.
 */
function collectSubtreeMiddlewareOwnerIds(
  store: Store,
  ownerChainNearestFirst: string[],
  readPolicyMiddlewares: (policy: SubtreePolicyInput) => unknown,
  target: unknown
): SubtreeOwnerIdsByKey {
  const ownerIds: SubtreeOwnerIdsByKey = new Map();

  for (const ownerResourceId of [...ownerChainNearestFirst].reverse()) {
    const ownerResource = store.resources.get(ownerResourceId)?.resource;
    if (!ownerResource) continue;

    for (const policy of getSubtreePolicies(ownerResource)) {
      const entries = readPolicyMiddlewares(policy);
      for (const entry of Array.isArray(entries) ? entries : []) {
        const middlewareId = resolveSubtreeMiddlewareEntry(entry, target);
        if (!middlewareId) continue;

        const duplicateKey = getMiddlewareDuplicateKey(middlewareId);
        if (!ownerIds.has(duplicateKey)) {
          ownerIds.set(duplicateKey, ownerResourceId);
        }
      }
    }
  }

  return ownerIds;
}

const identityCheckerDuplicateKey = getMiddlewareDuplicateKey(
  middleware.task.identityChecker.id
);

function countIdentityRequirements(identity: unknown): number {
  if (Array.isArray(identity)) return identity.length;
  return identity && typeof identity === "object" ? 1 : 0;
}

/**
 * Owner of each identityChecker gate Runner derives from subtree
 * `tasks.identity` requirements: one gate per requirement, owners walked
 * root-first. Runner puts these gates at the head of the task's stack in
 * exactly this order.
 */
function collectIdentityGateOwnerIds(
  store: Store,
  ownerChainNearestFirst: string[]
): string[] {
  const gateOwnerIds: string[] = [];

  for (const ownerResourceId of [...ownerChainNearestFirst].reverse()) {
    const ownerResource = store.resources.get(ownerResourceId)?.resource;
    if (!ownerResource) continue;

    for (const policy of getSubtreePolicies(ownerResource)) {
      const gateCount = countIdentityRequirements(policy.tasks?.identity);
      for (let gate = 0; gate < gateCount; gate++) {
        gateOwnerIds.push(ownerResourceId);
      }
    }
  }

  return gateOwnerIds;
}

function hasMiddlewareConfig(attachment: MiddlewareAttachment): boolean {
  return (
    Boolean(Reflect.get(attachment, definitions.symbolMiddlewareConfigured)) ||
    attachment.config !== undefined
  );
}

function toMiddlewareUsage(
  attachment: MiddlewareAttachment,
  subtreeOwnerId: string | null
): MiddlewareUsage {
  return {
    id: String(attachment.id),
    config: hasMiddlewareConfig(attachment)
      ? stringifyIfObject(attachment.config)
      : null,
    origin: subtreeOwnerId ? "subtree" : "local",
    subtreeOwnerId,
  };
}

function toLocalMiddlewareUsages(
  attachments: readonly MiddlewareAttachment[]
): MiddlewareUsage[] {
  return attachments.map((attachment) => toMiddlewareUsage(attachment, null));
}

type ApplicableMiddlewareResolver = {
  getApplicableTaskMiddlewares?: (
    taskDefinition: definitions.ITask
  ) => definitions.ITaskMiddleware[];
  getApplicableResourceMiddlewares?: (
    resourceDefinition: definitions.IResource
  ) => definitions.IResourceMiddleware[];
};

function getApplicableMiddlewareResolver(
  store: Store
): ApplicableMiddlewareResolver | null {
  // MiddlewareManager keeps the resolver private; introspection reads it
  // defensively so a Runner internals change degrades to local middleware
  // lists instead of crashing init.
  if (typeof store.getMiddlewareManager !== "function") return null;
  const resolver = (store.getMiddlewareManager() as any)?.middlewareResolver;
  if (!resolver || typeof resolver !== "object") return null;
  return resolver as ApplicableMiddlewareResolver;
}

/**
 * Runner's effective stack for a target, or null when it is unavailable:
 * the resolver is missing, returns an unexpected shape (it is private API),
 * or throws. It fails fast on subtree/local id conflicts, and introspection
 * must stay available to diagnose exactly such apps.
 */
function composeWithRunner(
  compose: () => unknown
): MiddlewareAttachment[] | null {
  try {
    const result = compose();
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

function resolveApplicableTaskMiddlewares(
  store: Store,
  task: definitions.ITask
): MiddlewareAttachment[] | null {
  const resolver = getApplicableMiddlewareResolver(store);
  const getApplicable = resolver?.getApplicableTaskMiddlewares;
  if (typeof getApplicable !== "function") return null;
  return composeWithRunner(() => getApplicable.call(resolver, task));
}

function resolveApplicableResourceMiddlewares(
  store: Store,
  resource: definitions.IResource
): MiddlewareAttachment[] | null {
  const resolver = getApplicableMiddlewareResolver(store);
  const getApplicable = resolver?.getApplicableResourceMiddlewares;
  if (typeof getApplicable !== "function") return null;
  return composeWithRunner(() => getApplicable.call(resolver, resource));
}

/**
 * Effective task middleware stack (subtree-composed when a store is given)
 * with per-usage provenance: `origin: "subtree"` plus the owning resource
 * when a subtree policy applied the middleware, through `tasks.middleware`
 * or as an identityChecker gate for a `tasks.identity` requirement.
 */
export function buildTaskMiddlewareUsages(
  task: definitions.ITask,
  store?: Store
): MiddlewareUsage[] {
  if (!store) return toLocalMiddlewareUsages(task.middleware || []);

  const applicable = resolveApplicableTaskMiddlewares(store, task);
  // Without Runner's composed stack only the task's own list is known, and
  // none of it came from a subtree policy, even where ids match one.
  if (!applicable) return toLocalMiddlewareUsages(task.middleware);

  // Tasks never own a subtree themselves; the chain starts at their owner.
  const ownerChain = getOwnerResourceChain(
    store,
    store.getOwnerResourceId(task.id)
  );
  const identityGateOwnerIds = collectIdentityGateOwnerIds(store, ownerChain);
  const subtreeOwnerIdsByKey = collectSubtreeMiddlewareOwnerIds(
    store,
    ownerChain,
    (policy) => policy.tasks?.middleware,
    task
  );

  return applicable.map((attachment, position) => {
    const duplicateKey = getMiddlewareDuplicateKey(String(attachment.id));
    // Gate positions belong to the owner that required the identity, not to
    // an owner that also lists identityChecker in its tasks.middleware.
    const isIdentityGate =
      position < identityGateOwnerIds.length &&
      duplicateKey === identityCheckerDuplicateKey;
    const subtreeOwnerId = isIdentityGate
      ? identityGateOwnerIds[position]
      : subtreeOwnerIdsByKey.get(duplicateKey) ?? null;
    return toMiddlewareUsage(attachment, subtreeOwnerId);
  });
}

/**
 * Resource counterpart of buildTaskMiddlewareUsages, driven by subtree
 * `resources.middleware` policies.
 */
export function buildResourceMiddlewareUsages(
  resource: definitions.IResource,
  store?: Store
): MiddlewareUsage[] {
  if (!store) return toLocalMiddlewareUsages(resource.middleware || []);

  const applicable = resolveApplicableResourceMiddlewares(store, resource);
  if (!applicable) return toLocalMiddlewareUsages(resource.middleware);

  // Runner starts a resource's owner chain at the resource itself, so its
  // own subtree resource middleware applies to it as well.
  const subtreeOwnerIdsByKey = collectSubtreeMiddlewareOwnerIds(
    store,
    getOwnerResourceChain(store, resource.id),
    (policy) => policy.resources?.middleware,
    resource
  );
  return applicable.map((attachment) =>
    toMiddlewareUsage(
      attachment,
      subtreeOwnerIdsByKey.get(
        getMiddlewareDuplicateKey(String(attachment.id))
      ) ?? null
    )
  );
}
