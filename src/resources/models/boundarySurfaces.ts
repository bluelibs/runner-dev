import type { BoundarySurface, Resource } from "../../schema";

type ResourceById = Map<string, Resource>;

function buildResourceMap(resources: Resource[]): ResourceById {
  const map: ResourceById = new Map();
  for (const resource of resources) {
    map.set(resource.id, resource);
  }
  return map;
}

function collectBoundaryResourceIds(
  ownerId: string,
  resourcesById: ResourceById,
  visited: Set<string> = new Set()
): Set<string> {
  if (visited.has(ownerId)) {
    // One resource can appear through multiple registration paths in the
    // serialized graph; traversal only needs each subtree once.
    return visited;
  }

  visited.add(ownerId);
  const owner = resourcesById.get(ownerId);
  if (!owner) {
    return visited;
  }

  for (const registeredId of owner.registers) {
    if (resourcesById.has(registeredId)) {
      collectBoundaryResourceIds(registeredId, resourcesById, visited);
    }
  }

  return visited;
}

function collectBoundaryElementIds(
  ownerId: string,
  resourcesById: ResourceById
): Set<string> {
  const elementIds = new Set<string>();

  for (const resourceId of collectBoundaryResourceIds(ownerId, resourcesById)) {
    const resource = resourcesById.get(resourceId);
    for (const registeredId of resource?.registers ?? []) {
      elementIds.add(registeredId);
    }
  }

  return elementIds;
}

function sortedIds(ids: Set<string>): string[] {
  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

function collectEffectiveExports(
  ownerId: string,
  resourcesById: ResourceById,
  cache: Map<string, string[]>,
  visiting: Set<string> = new Set()
): { exports: string[]; complete: boolean } {
  const cached = cache.get(ownerId);
  if (cached) {
    return { exports: cached, complete: true };
  }

  if (visiting.has(ownerId)) {
    // Exports form a cycle back to a resource already being resolved up the
    // stack. It contributes nothing new to this set union, so break the
    // recursion instead of aborting all boundary computation (and with it
    // live init and snapshot loading). Marked incomplete so the partial
    // result is never cached.
    return { exports: [], complete: false };
  }

  const owner = resourcesById.get(ownerId);
  if (!owner) {
    return { exports: [], complete: true };
  }

  const exportsMode = owner.isolation?.exportsMode ?? "unset";
  if (exportsMode === "none") {
    const none: string[] = [];
    cache.set(ownerId, none);
    return { exports: none, complete: true };
  }

  if (exportsMode === "unset") {
    const allElements = sortedIds(
      collectBoundaryElementIds(ownerId, resourcesById)
    );
    cache.set(ownerId, allElements);
    return { exports: allElements, complete: true };
  }

  visiting.add(ownerId);
  const exports = new Set<string>();
  let complete = true;
  for (const exportedId of owner.isolation?.exports ?? []) {
    exports.add(exportedId);

    if (!resourcesById.has(exportedId)) {
      continue;
    }

    const nested = collectEffectiveExports(
      exportedId,
      resourcesById,
      cache,
      visiting
    );
    if (!nested.complete) {
      complete = false;
    }
    for (const nestedExport of nested.exports) {
      exports.add(nestedExport);
    }
  }
  visiting.delete(ownerId);

  const result = sortedIds(exports);
  // Only cache cycle-free results: a value computed while a cycle was cut
  // beneath it depends on traversal order.
  if (complete) {
    cache.set(ownerId, result);
  }
  return { exports: result, complete };
}

export function buildBoundarySurfaces(
  resources: Resource[]
): BoundarySurface[] {
  const resourcesById = buildResourceMap(resources);
  const effectiveExportsCache = new Map<string, string[]>();
  const boundaryElementsCache = new Map<string, Set<string>>();

  return resources
    .map((resource) => {
      const boundaryElements =
        boundaryElementsCache.get(resource.id) ??
        collectBoundaryElementIds(resource.id, resourcesById);
      boundaryElementsCache.set(resource.id, boundaryElements);

      const effectiveExports = new Set(
        collectEffectiveExports(
          resource.id,
          resourcesById,
          effectiveExportsCache
        ).exports
      );
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
