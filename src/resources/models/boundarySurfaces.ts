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
): string[] {
  const cached = cache.get(ownerId);
  if (cached) {
    return cached;
  }

  if (visiting.has(ownerId)) {
    throw new Error(
      `Boundary surface cycle detected at resource "${ownerId}".`
    );
  }

  const owner = resourcesById.get(ownerId);
  if (!owner) {
    return [];
  }

  const exportsMode = owner.isolation?.exportsMode ?? "unset";
  if (exportsMode === "none") {
    const none: string[] = [];
    cache.set(ownerId, none);
    return none;
  }

  if (exportsMode === "unset") {
    const allElements = sortedIds(
      collectBoundaryElementIds(ownerId, resourcesById)
    );
    cache.set(ownerId, allElements);
    return allElements;
  }

  visiting.add(ownerId);
  const exports = new Set<string>();
  for (const exportedId of owner.isolation?.exports ?? []) {
    exports.add(exportedId);

    if (!resourcesById.has(exportedId)) {
      continue;
    }

    for (const nestedExport of collectEffectiveExports(
      exportedId,
      resourcesById,
      cache,
      visiting
    )) {
      exports.add(nestedExport);
    }
  }
  visiting.delete(ownerId);

  const result = sortedIds(exports);
  cache.set(ownerId, result);
  return result;
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
        )
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
