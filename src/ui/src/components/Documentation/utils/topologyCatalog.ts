import { ensureStringArray } from "../../../../../resources/models/introspector.tools";
import type { BaseElement } from "../../../../../schema/model";
import type { Introspector } from "../../../../../resources/models/Introspector";
import type { PaletteElementEntry } from "./commandPalette";
import type { TopologyFocus } from "./topologyGraph";
import { getDefaultTopologyFocus } from "./topologyGraph.state";

export interface CatalogElement extends TopologyFocus {
  label: string;
  owner?: string;
  description?: string | null;
}

export function buildTopologyCatalog(source: Introspector) {
  const elements = new Map<string, CatalogElement>();
  const children = new Map<string, CatalogElement[]>();
  const entries: PaletteElementEntry[] = [];
  const resources = source.getResources();
  const registrations = new Map<string, string>();
  for (const resource of resources) {
    for (const id of ensureStringArray(resource.registers)) {
      if (!registrations.has(id)) registrations.set(id, resource.id);
    }
  }
  function add(kind: TopologyFocus["kind"], group: BaseElement[]) {
    for (const item of group) {
      const label = item.meta?.title || item.id.split(".").pop() || item.id;
      const explicitOwner =
        item.registeredBy && source.getResource(item.registeredBy);
      const owner =
        (explicitOwner && explicitOwner.id) || registrations.get(item.id);
      const entry = {
        id: item.id,
        kind,
        label,
        owner,
        description: item.meta?.description,
      };
      elements.set(item.id, entry);
      entries.push({
        kind: "element",
        elementKind: kind,
        id: item.id,
        title: label,
      });
      if (!owner || owner === item.id) continue;
      const siblings = children.get(owner) ?? [];
      siblings.push(entry);
      children.set(owner, siblings);
    }
  }
  add("resource", resources);
  add("task", source.getTasks());
  add("event", source.getEvents());
  add("hook", source.getHooks());
  add("middleware", source.getMiddlewares());
  add("asyncContext", source.getAsyncContexts());
  add("error", source.getErrors());
  add("tag", source.getAllTags());
  for (const siblings of children.values())
    siblings.sort((a, b) => a.label.localeCompare(b.label));
  const root = getDefaultTopologyFocus(source);
  return {
    elements,
    children,
    entries,
    rootId: root?.kind === "resource" ? root.id : undefined,
  };
}

export type TopologyCatalog = ReturnType<typeof buildTopologyCatalog>;

export function ownerTrail(catalog: TopologyCatalog, id?: string) {
  const path: CatalogElement[] = [];
  const seen = new Set<string>();
  let node = id ? catalog.elements.get(id) : undefined;
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    path.push(node);
    node = node.owner ? catalog.elements.get(node.owner) : undefined;
  }
  return path.reverse();
}
