import type { BoundarySurface, Resource } from "../../schema";

type ResourceById = Map<string, Resource>;

function buildResourceMap(resources: Resource[]): ResourceById {
  const map: ResourceById = new Map();
  for (const resource of resources) {
    map.set(resource.id, resource);
  }
  return map;
}

function collectBoundaryResources(
  owner: Resource,
  resourcesById: ResourceById,
  visited: Map<string, Resource> = new Map()
): Map<string, Resource> {
  if (visited.has(owner.id)) {
    // One resource can appear through multiple registration paths in the
    // serialized graph; traversal only needs each subtree once.
    return visited;
  }

  visited.set(owner.id, owner);
  for (const registeredId of owner.registers) {
    const registeredResource = resourcesById.get(registeredId);
    if (registeredResource) {
      collectBoundaryResources(registeredResource, resourcesById, visited);
    }
  }

  return visited;
}

function collectBoundaryElementIds(
  owner: Resource,
  resourcesById: ResourceById
): Set<string> {
  const elementIds = new Set<string>();

  for (const resource of collectBoundaryResources(
    owner,
    resourcesById
  ).values()) {
    for (const registeredId of resource.registers) {
      elementIds.add(registeredId);
    }
  }

  return elementIds;
}

function sortedIds(ids: Set<string>): string[] {
  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

/** Tarjan bookkeeping for a "list" owner whose export cycle is unresolved. */
type CycleFrame = {
  visitOrder: number;
  lowestReachableOrder: number;
  stackDepth: number;
};

/**
 * Resolves effective exports for every owner in one shared pass.
 *
 * A "list" owner re-exports the effective exports of every resource it
 * lists, so exports can form cycles. Every owner in one strongly-connected
 * export cycle reaches the same set, so the cycle is resolved once with
 * Tarjan's algorithm and the result is shared by all its members. This keeps
 * each owner's exports expanded once, instead of re-walking the cycle for
 * every path into it (factorial on dense cycles).
 */
class EffectiveExportsResolver {
  private readonly resolved = new Map<string, string[]>();
  private readonly framesOnStack = new Map<string, CycleFrame>();
  private readonly cycleStack: string[] = [];
  private nextVisitOrder = 0;

  constructor(private readonly resourcesById: ResourceById) {}

  resolve(owner: Resource): Set<string> {
    return new Set(this.visit(owner));
  }

  private visit(owner: Resource): Iterable<string> {
    const resolved = this.resolved.get(owner.id);
    if (resolved) {
      return resolved;
    }

    const isolation = owner.isolation;
    if (!isolation || isolation.exportsMode === "unset") {
      return this.remember(
        owner.id,
        collectBoundaryElementIds(owner, this.resourcesById)
      );
    }

    if (isolation.exportsMode === "none") {
      return this.remember(owner.id, new Set());
    }

    return this.visitListedExports(owner.id, isolation.exports);
  }

  private visitListedExports(
    ownerId: string,
    listedExports: string[]
  ): Set<string> {
    const frame: CycleFrame = {
      visitOrder: this.nextVisitOrder,
      lowestReachableOrder: this.nextVisitOrder,
      stackDepth: this.cycleStack.length,
    };
    this.nextVisitOrder += 1;
    this.framesOnStack.set(ownerId, frame);
    this.cycleStack.push(ownerId);

    const exports = new Set<string>();
    for (const exportedId of listedExports) {
      exports.add(exportedId);
      const exportedOwner = this.resourcesById.get(exportedId);
      if (!exportedOwner) {
        continue;
      }

      const pendingFrame = this.framesOnStack.get(exportedId);
      if (pendingFrame) {
        // Back into the cycle being resolved: the cycle root unions this
        // owner's exports, so only the link needs recording here.
        frame.lowestReachableOrder = Math.min(
          frame.lowestReachableOrder,
          pendingFrame.visitOrder
        );
        continue;
      }

      for (const nestedExport of this.visit(exportedOwner)) {
        exports.add(nestedExport);
      }
      // Still pending after the visit: the exported owner belongs to the
      // same cycle, which is only complete once its root finishes.
      const nestedFrame = this.framesOnStack.get(exportedId);
      if (nestedFrame) {
        frame.lowestReachableOrder = Math.min(
          frame.lowestReachableOrder,
          nestedFrame.lowestReachableOrder
        );
      }
    }

    if (frame.lowestReachableOrder === frame.visitOrder) {
      this.resolveCycle(frame, exports);
    }
    return exports;
  }

  private resolveCycle(rootFrame: CycleFrame, exports: Set<string>): void {
    const result = sortedIds(exports);
    for (const memberId of this.cycleStack.splice(rootFrame.stackDepth)) {
      this.framesOnStack.delete(memberId);
      this.resolved.set(memberId, result);
    }
  }

  private remember(ownerId: string, exports: Set<string>): string[] {
    const result = sortedIds(exports);
    this.resolved.set(ownerId, result);
    return result;
  }
}

export function buildBoundarySurfaces(
  resources: Resource[]
): BoundarySurface[] {
  const resourcesById = buildResourceMap(resources);
  const effectiveExportsResolver = new EffectiveExportsResolver(resourcesById);
  const boundaryElementsCache = new Map<string, Set<string>>();

  return resources
    .map((resource) => {
      const boundaryElements =
        boundaryElementsCache.get(resource.id) ??
        collectBoundaryElementIds(resource, resourcesById);
      boundaryElementsCache.set(resource.id, boundaryElements);

      const effectiveExports = effectiveExportsResolver.resolve(resource);
      const privateDefinitions = Array.from(boundaryElements).filter(
        (elementId) => !effectiveExports.has(elementId)
      );

      return {
        ownerId: resource.id,
        exportsDeclared:
          (resource.isolation?.exportsMode ?? "unset") !== "unset",
        declaredExports: [...(resource.isolation?.exports ?? [])].sort(
          (left, right) => left.localeCompare(right)
        ),
        effectiveExports: sortedIds(effectiveExports),
        privateDefinitions: sortedIds(new Set(privateDefinitions)),
      } satisfies BoundarySurface;
    })
    .sort((left, right) => left.ownerId.localeCompare(right.ownerId));
}
