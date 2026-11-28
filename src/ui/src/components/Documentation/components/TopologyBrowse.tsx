import React from "react";
import { DocIcon } from "./common/DocIcon";
import { filterPaletteEntries } from "../utils/commandPalette";
import {
  ownerTrail,
  type CatalogElement,
  type TopologyCatalog,
} from "../utils/topologyCatalog";
import {
  buildTopologyHash,
  defaultViewForKind,
} from "../utils/topologyGraph.state";

function branchLink(owner?: string) {
  return owner ? `#topology?owner=${encodeURIComponent(owner)}` : "#topology";
}
export function elementLink(node: CatalogElement) {
  return buildTopologyHash({
    focus: node,
    view: defaultViewForKind(node.kind),
    radius: 1,
  });
}

export function TopologyBrowse({
  catalog,
  owner,
  focus,
}: {
  catalog: TopologyCatalog;
  owner?: string;
  focus?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(30);
  const searching = Boolean(query.trim());
  const branch = owner ?? catalog.rootId;
  const rows = React.useMemo(() => {
    if (searching)
      return filterPaletteEntries(catalog.entries, query, {
        elements: Infinity,
      }).flatMap(({ entry }) => catalog.elements.get(entry.id) ?? []);
    if (focus) return [];
    const children = branch ? catalog.children.get(branch) ?? [] : [];
    if (owner) return children;
    const resources = children.filter((item) => item.kind === "resource");
    if (resources.length) return resources;
    if (children.length) return children;
    return [...catalog.elements.values()].filter((item) => !item.owner);
  }, [branch, catalog, focus, owner, query, searching]);
  const resource = owner ? catalog.elements.get(owner) : undefined;
  const trail = ownerTrail(catalog, focus ?? branch);
  return (
    <section className="topology-browse" aria-label="Topology navigation">
      <div className="browse-toolbar">
        <nav aria-label="Ownership breadcrumb">
          <a href="#topology">Browse by owner</a>
          {trail.map((part) => (
            <React.Fragment key={part.id}>
              <DocIcon name="chevron-right" size={12} />
              {part.kind === "resource" ? (
                <a href={branchLink(part.id)}>{part.label}</a>
              ) : (
                <span>{part.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
        <label className="jump-search">
          <DocIcon name="diagnostics" size={14} />
          <input
            type="search"
            value={query}
            aria-label="Jump to element"
            placeholder="Jump to element…"
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(30);
            }}
          />
        </label>
      </div>
      {(!focus || searching) && (
        <>
          <h3>
            {searching
              ? `Search results (${rows.length})`
              : owner
              ? "Registered elements"
              : "Application resources"}
          </h3>
          {resource && !searching && (
            <a href={elementLink(resource)}>View resource relationships</a>
          )}
          <ul>
            {rows.slice(0, limit).map((item) => {
              const count = catalog.children.get(item.id)?.length ?? 0;
              const browse =
                !searching && item.kind === "resource" && count > 0;
              return (
                <li key={item.id}>
                  <div className="browse-result-name">
                    <a
                      title={item.id}
                      href={browse ? branchLink(item.id) : elementLink(item)}
                    >
                      <DocIcon name={item.kind} size={15} /> {item.label}
                    </a>
                    {searching && item.label !== item.id && (
                      <code>{item.id}</code>
                    )}
                  </div>
                  <small>
                    {item.kind}
                    {item.kind === "resource" ? ` · ${count} registered` : ""}
                    {searching && item.owner
                      ? ` · ${ownerTrail(catalog, item.owner)
                          .map((part) => part.label)
                          .join(" › ")}`
                      : ""}
                  </small>
                </li>
              );
            })}
          </ul>
          {!rows.length && (
            <p>
              {searching ? "No matching elements." : "No registered children."}
            </p>
          )}
          {rows.length > limit && (
            <button
              type="button"
              className="btn"
              onClick={() => setLimit(limit + 30)}
            >
              Show more
            </button>
          )}
        </>
      )}
    </section>
  );
}
