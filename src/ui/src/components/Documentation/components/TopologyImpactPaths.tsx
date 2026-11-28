import React from "react";
import { DocIcon } from "./common/DocIcon";
import type { Introspector } from "../../../../../resources/models/Introspector";
import type { TopologyCatalog } from "../utils/topologyCatalog";
import {
  buildTopologyProjection,
  type TopologyFocus,
} from "../utils/topologyGraph";
import { elementLink } from "./TopologyBrowse";
import { TopologyRow, matchesNode } from "./TopologyRelationships";
import { TopologyOwnerGroups } from "./TopologyOwnerGroups";
import type {
  TopologyEdgeKind,
  TopologyGraphNode,
} from "../utils/topologyGraph";
import { buildTopologyHash } from "../utils/topologyGraph.state";
import { copyToClipboard } from "./chat/ChatUtils";
import { groupImpactNodes, formatHiddenByFilters } from "./topologyPanel.utils";

const verbs: Record<TopologyEdgeKind, string> = {
  "depends-on": "depends on",
  emits: "emits",
  "listens-to": "listens to",
  "listened-to-by": "is handled by",
  registers: "registers",
  "registered-by": "is registered by",
  "uses-middleware": "uses middleware",
  overrides: "overrides",
  "thrown-by": "is thrown by",
  "provided-by": "is provided by",
  "required-by": "is required by",
  "used-by": "is used by",
  tagged: "is applied to",
  "emitted-by": "is emitted by",
};

function explain(nodes: Map<string, TopologyGraphNode>, id: string) {
  const steps: TopologyGraphNode[] = [];
  const seen = new Set<string>();
  let node = nodes.get(id);
  while (node?.parentId && node.parentRelationKind && !seen.has(node.id)) {
    seen.add(node.id);
    const parent = nodes.get(node.parentId);
    if (!parent) break;
    steps.unshift(node);
    node = parent;
  }
  if (node?.isFocus && steps.length) return [node, ...steps];
  return [];
}

export function CopyTopologyLink({ hash }: { hash: string }) {
  const [status, setStatus] = React.useState("");
  React.useEffect(() => setStatus(""), [hash]);
  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          const url = new URL(window.location.href);
          url.hash = hash;
          setStatus(
            (await copyToClipboard(url.href))
              ? "Link copied"
              : "Copy the address from your browser"
          );
        }}
      >
        <DocIcon name="link" size={13} /> Copy link
      </button>{" "}
      <span role="status">{status}</span>
    </>
  );
}

export function TopologyImpactPanel({
  source,
  catalog,
  focus,
  radius,
  why,
  visibleIds,
  query,
}: {
  source: Introspector;
  catalog: TopologyCatalog;
  focus: TopologyFocus;
  radius: number;
  why?: string;
  visibleIds: Set<string>;
  query: string;
}) {
  const nodes = React.useMemo(
    () =>
      buildTopologyProjection(source, {
        focusId: focus.id,
        focusKind: focus.kind,
        view: "blast",
        radius,
        visibleIds,
      }).nodes,
    [source, focus.id, focus.kind, radius, visibleIds]
  );
  const nodesById = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const groups = React.useMemo(
    () =>
      groupImpactNodes(
        nodes.map((node) => ({
          ...node,
          isVisible: node.isVisible && matchesNode(catalog, node, query),
        }))
      ),
    [nodes, catalog, query]
  );
  const steps = why ? explain(nodesById, why) : [];
  const pathRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (why) pathRef.current?.focus();
  }, [why]);
  const pathHash = (depth: number, target?: string) =>
    buildTopologyHash({
      focus,
      view: "blast",
      paths: true,
      radius: depth,
      why: target,
    });

  return (
    <>
      <div className="path-controls">
        <label>
          Path depth{" "}
          <select
            value={radius}
            onChange={(event) => {
              window.location.hash = pathHash(Number(event.target.value));
            }}
          >
            {[1, 2, 3, 4].map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? "step" : "steps"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {why && (
        <section
          ref={pathRef}
          tabIndex={-1}
          className="topology-impact-path"
          aria-label="Impact path"
        >
          <header>
            <h3>Path to {catalog.elements.get(why)?.label ?? why}</h3>
            <div className="path-actions">
              <CopyTopologyLink hash={pathHash(radius, why)} />
              <a
                href={pathHash(radius)}
                aria-label="Close path"
                title="Close path"
              >
                <DocIcon name="x" size={15} />
              </a>
            </div>
          </header>
          {steps.length ? (
            <ol>
              {steps.map((step, index) => {
                const entry = catalog.elements.get(step.id);
                return (
                  <li key={step.id}>
                    {index > 0 && step.parentRelationKind && (
                      <span>{verbs[step.parentRelationKind]}</span>
                    )}
                    {entry ? (
                      <a href={elementLink(entry)} title={entry.id}>
                        {entry.label}
                      </a>
                    ) : (
                      step.label
                    )}
                    <small>{step.kind}</small>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>This path is unavailable at the selected depth.</p>
          )}
        </section>
      )}
      {!groups.length && (
        <p>
          No downstream relationships or contract partners are recorded within
          this depth.
        </p>
      )}
      <div className="relations-list">
        {groups.map((group) => (
          <section className="relation-group" key={group.title}>
            <h3 title={group.hint}>
              {group.title}{" "}
              <span>{group.visibleNodes.length + group.hiddenCount}</span>
            </h3>
            <div className="relation-members">
              <TopologyOwnerGroups
                nodes={group.visibleNodes}
                selectedId={why}
                render={(node) => (
                  <TopologyRow key={node.id} node={node} catalog={catalog}>
                    <a
                      className="trace-link"
                      aria-label={`View path to ${
                        catalog.elements.get(node.id)?.label ?? node.label
                      }`}
                      href={pathHash(radius, node.id)}
                    >
                      View path
                    </a>
                  </TopologyRow>
                )}
              />
              {group.hiddenCount > 0 && (
                <small>{formatHiddenByFilters(group.hiddenCount)}</small>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
