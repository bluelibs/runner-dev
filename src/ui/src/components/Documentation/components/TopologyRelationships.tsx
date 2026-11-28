import React from "react";
import { DocIcon } from "./common/DocIcon";
import type { Introspector } from "../../../../../resources/models/Introspector";
import {
  directTopologyRelations,
  type TopologyEdgeKind,
  type TopologyFocus,
} from "../utils/topologyGraph";
import type { TopologyCatalog } from "../utils/topologyCatalog";
import { elementLink } from "./TopologyBrowse";
import { TopologyOwnerGroups } from "./TopologyOwnerGroups";

const headings: Record<TopologyEdgeKind, string> = {
  "depends-on": "Depends on",
  "used-by": "Used by",
  registers: "Registers",
  "registered-by": "Owned by",
  emits: "Emits",
  "listened-to-by": "Handled by",
  "listens-to": "Listens to",
  "emitted-by": "Emitted by",
  "uses-middleware": "Uses middleware",
  overrides: "Overrides",
  "provided-by": "Provided by",
  "required-by": "Required by",
  "thrown-by": "Thrown by",
  tagged: "Applied to",
};

export function TopologyRow({
  node,
  catalog,
  children,
}: {
  node: TopologyFocus;
  catalog: TopologyCatalog;
  children?: React.ReactNode;
}) {
  const entry = catalog.elements.get(node.id);
  if (!entry) return null;
  return (
    <div className="relation-row">
      <a href={elementLink(entry)}>
        <DocIcon name={entry.kind} size={15} />
        <strong>{entry.label}</strong>
        <code title={entry.id}>{entry.id}</code>
      </a>
      <span className="relation-kind">{entry.kind}</span>
      {children}
    </div>
  );
}

export function TopologyRelationships({
  source,
  focus,
  catalog,
  visibleIds,
  query,
}: {
  source: Introspector;
  focus: TopologyFocus;
  catalog: TopologyCatalog;
  visibleIds: Set<string>;
  query: string;
}) {
  const groups = React.useMemo(() => {
    const relations = directTopologyRelations(source, focus);
    const byKind = new Map<TopologyEdgeKind, Map<string, TopologyFocus>>();
    for (const relation of relations) {
      const bucket = byKind.get(relation.kind) ?? new Map();
      for (const target of relation.targets)
        if (target.id !== focus.id) bucket.set(target.id, target);
      byKind.set(relation.kind, bucket);
    }
    const ownerId = catalog.elements.get(focus.id)?.owner;
    const owner = ownerId && catalog.elements.get(ownerId);
    if (owner && owner.id !== focus.id)
      byKind.set("registered-by", new Map([[owner.id, owner]]));
    return [...byKind]
      .map(([kind, bucket]) => ({
        kind,
        nodes: [...bucket.values()].sort((a, b) =>
          (catalog.elements.get(a.id)?.label ?? a.id).localeCompare(
            catalog.elements.get(b.id)?.label ?? b.id
          )
        ),
      }))
      .filter((group) => group.nodes.length);
  }, [source, focus.id, catalog]);
  const rows = groups.map(({ kind, nodes }) => ({
    kind,
    total: nodes.length,
    visible: nodes.filter(
      (node) => visibleIds.has(node.id) && matchesNode(catalog, node, query)
    ),
  }));
  if (!rows.length)
    return <p>No direct relationships are recorded for this element.</p>;
  return (
    <div className="relations-list">
      {rows.map(({ kind, total, visible }) => (
        <section className="relation-group" key={kind}>
          <h3>
            {headings[kind]} <span>{total}</span>
          </h3>
          <div className="relation-members">
            <TopologyOwnerGroups
              nodes={visible}
              render={(node) => (
                <TopologyRow key={node.id} node={node} catalog={catalog} />
              )}
            />
            {visible.length < total && (
              <small>{total - visible.length} hidden by filters</small>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function matchesNode(
  catalog: TopologyCatalog,
  node: TopologyFocus,
  query: string
) {
  const entry = catalog.elements.get(node.id);
  return [node.id, node.kind, entry?.label, entry?.description]
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}
