import React from "react";
import { ownerTrail, type TopologyCatalog } from "../utils/topologyCatalog";
import type { TopologyFocus } from "../utils/topologyGraph";

export const TopologyCatalogContext =
  React.createContext<TopologyCatalog | null>(null);
function OwnerGroup<T extends TopologyFocus>({
  label,
  members,
  selectedIndex,
  render,
}: {
  label: string;
  members: T[];
  selectedIndex: number;
  render: (node: T) => React.ReactNode;
}) {
  const [limit, setLimit] = React.useState(40);
  const [expanded, setExpanded] = React.useState(selectedIndex >= 0);
  React.useEffect(() => {
    if (selectedIndex >= 0) setExpanded(true);
  }, [selectedIndex]);
  const selectedOutsidePage =
    selectedIndex >= limit ? members[selectedIndex] : undefined;
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
          {selectedOutsidePage && render(selectedOutsidePage)}
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
        const selectedIndex = members.findIndex(
          (item) => item.id === selectedId
        );
        return (
          <OwnerGroup
            key={owner}
            label={catalog.elements.get(owner)?.label ?? "Unassigned"}
            members={members}
            selectedIndex={selectedIndex}
            render={render}
          />
        );
      })}
    </>
  );
}
