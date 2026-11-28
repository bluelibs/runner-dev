import React from "react";
import { DocIcon } from "./common/DocIcon";
import type {
  Task,
  Event,
  Hook,
  Middleware,
  Resource,
  Tag,
} from "../../../../../schema/model";
import type { Introspector } from "../../../../../resources/models/Introspector";
import { buildTopologyCatalog } from "../utils/topologyCatalog";
import { resolveFocus } from "../utils/topologyGraph";
import {
  buildTopologyHash,
  parseTopologyHash,
  DEFAULT_TOPOLOGY_RADIUS,
} from "../utils/topologyGraph.state";
import { TopologyBrowse } from "./TopologyBrowse";
import { CopyTopologyLink, TopologyImpactPanel } from "./TopologyImpactPaths";
import { TopologyCatalogContext } from "./TopologyOwnerGroups";
import { TopologyRelationships } from "./TopologyRelationships";
import "./TopologyPanel.scss";

export interface TopologyPanelProps {
  introspector: Introspector;
  tasks: Task[];
  resources: Resource[];
  events: Event[];
  hooks: Hook[];
  middlewares: Middleware[];
  errors: Array<{ id: string }>;
  asyncContexts: Array<{ id: string }>;
  tags: Tag[];
}

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
const currentHash = () => window.location.hash;

export function TopologyPanel({
  introspector,
  tasks,
  resources,
  events,
  hooks,
  middlewares,
  errors,
  asyncContexts,
  tags,
}: TopologyPanelProps) {
  const hash = React.useSyncExternalStore(subscribeHash, currentHash, () => "");
  const route = parseTopologyHash(hash);
  const catalog = React.useMemo(
    () => buildTopologyCatalog(introspector),
    [introspector]
  );
  const visibleIds = React.useMemo(
    () =>
      new Set(
        [
          ...tasks,
          ...resources,
          ...events,
          ...hooks,
          ...middlewares,
          ...errors,
          ...asyncContexts,
          ...tags,
        ].map((item) => item.id)
      ),
    [tasks, resources, events, hooks, middlewares, errors, asyncContexts, tags]
  );
  const requested = route?.focus;
  const focus = React.useMemo(
    () => requested && resolveFocus(introspector, requested.id, requested.kind),
    [introspector, requested?.id, requested?.kind]
  );
  const entry = focus && catalog.elements.get(focus.id);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => setQuery(""), [focus?.id]);
  if (!requested || !entry || entry.kind !== requested.kind)
    return (
      <section id="topology" className="docs-section topology-panel">
        <h2>
          <DocIcon name="topology" size={21} className="doc-icon--accent" />
          Topology
        </h2>
        {requested && <p>This element is unavailable in this catalog.</p>}
        <TopologyBrowse
          key={route?.owner ?? ""}
          catalog={catalog}
          owner={route?.owner}
        />
      </section>
    );
  const paths = Boolean(route?.paths || route?.why);
  const radius = route?.radius ?? DEFAULT_TOPOLOGY_RADIUS;
  const link = (showPaths: boolean, why?: string) =>
    buildTopologyHash({
      focus: entry,
      view: "blast",
      paths: showPaths,
      radius,
      why,
    });
  return (
    <TopologyCatalogContext.Provider value={catalog}>
      <section id="topology" className="docs-section topology-panel">
        <TopologyBrowse key={entry.id} catalog={catalog} focus={entry.id} />
        <header className="relations-header">
          <div>
            <h2>
              <DocIcon
                name={entry.kind}
                size={22}
                className="doc-icon--accent"
              />
              {entry.label}
            </h2>
            <div className="relations-meta">
              <span>{entry.kind}</span>
              <code>{entry.id}</code>
            </div>
            {entry.description && <p>{entry.description}</p>}
          </div>
          <div className="relations-actions">
            <a href={`#element-${entry.id}`}>
              <DocIcon name="external" size={13} /> Open card
            </a>
            {!route?.why && <CopyTopologyLink hash={link(paths)} />}
          </div>
        </header>
        <div className="relations-tools docs-section-tabs">
          <nav aria-label="Relationship views">
            <a
              className={
                !paths
                  ? "docs-section-tab docs-section-tab--active"
                  : "docs-section-tab"
              }
              href={link(false)}
              aria-current={!paths ? "page" : undefined}
            >
              <DocIcon name="list" size={14} /> Relationships
            </a>
            <a
              className={
                paths
                  ? "docs-section-tab docs-section-tab--active"
                  : "docs-section-tab"
              }
              href={link(true)}
              aria-current={paths ? "page" : undefined}
            >
              <DocIcon name="tree" size={14} /> Impact paths
            </a>
          </nav>
          <input
            type="search"
            aria-label="Filter relationships"
            placeholder="Filter this list…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {paths ? (
          <TopologyImpactPanel
            source={introspector}
            catalog={catalog}
            focus={entry}
            radius={radius}
            why={route?.why}
            visibleIds={visibleIds}
            query={query}
          />
        ) : (
          <TopologyRelationships
            source={introspector}
            catalog={catalog}
            focus={entry}
            visibleIds={visibleIds}
            query={query}
          />
        )}
      </section>
    </TopologyCatalogContext.Provider>
  );
}
