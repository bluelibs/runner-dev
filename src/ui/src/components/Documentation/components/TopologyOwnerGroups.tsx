import React from "react";
import { ownerTrail, type TopologyCatalog } from "../utils/topologyCatalog";
import type { TopologyFocus } from "../utils/topologyGraph";

export const TopologyCatalogContext =
  React.createContext<TopologyCatalog | null>(null);
function OwnerGroup<T extends TopologyFocus>({
  label,
  members,
  selected,
  render,
}: {
  label: string;
  members: T[];
  selected: boolean;
  render: (node: T) => React.ReactNode;
}) {
  const [limit, setLimit] = React.useState(40);
  const [expanded, setExpanded] = React.useState(selected);
  return (
    <div>
      <button
        type="button"
        className="btn"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {label} ({members.length})
      </button>
      {expanded && (
        <>
          {members.slice(0, limit).map(render)}
          {limit < members.length && (
            <button
              type="button"
              className="btn"
              onClick={() => setLimit(limit + 40)}
            >
              Show more
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function TopologyOwnerGroups<T extends TopologyFocus>({
  nodes,
  selectedId,
  render,
}: {
  nodes: T[];
  selectedId?: string;
  render: (node: T) => React.ReactNode;
}) {
  const catalog = React.useContext(TopologyCatalogContext);
  if (nodes.length <= 12 || !catalog) return <>{nodes.map(render)}</>;
  const owners = new Map<string, T[]>();
  for (const node of nodes) {
    const trail = ownerTrail(catalog, catalog.elements.get(node.id)?.owner);
    const feature =
      trail.find((part) => part.id !== catalog.rootId) ?? trail[0];
    const owner = feature?.id ?? "";
    const group = owners.get(owner) ?? [];
    group.push(node);
    owners.set(owner, group);
  }
  return (
    <>
      {Array.from(owners, ([owner, members]) => {
        const selected = members.some((item) => item.id === selectedId);
        return (
          <OwnerGroup
            key={JSON.stringify([owner, selected])}
            label={catalog.elements.get(owner)?.label ?? "Unassigned"}
            members={members}
            selected={selected}
            render={render}
          />
        );
      })}
    </>
  );
}
