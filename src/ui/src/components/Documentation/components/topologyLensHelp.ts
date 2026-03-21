import type { TopologyViewMode } from "../utils/topologyGraph";

const TOPOLOGY_LENS_DESCRIPTIONS: Record<TopologyViewMode, string> = {
  blast:
    "**Blast Radius** follows the focused node's outward impact chain. " +
    "It treats the traversal path as the main story, so you can see what this node touches next and how effects fan out.\n\n" +
    "Use it when you want to answer: _what could this trigger, affect, or wake up?_ " +
    "Compared with **Mindmap**, it is more impact-oriented and less about ownership structure.",
  mindmap:
    "**Mindmap** organizes the topology around the focused resource's structural neighborhood. " +
    "For resource views, the primary spine stays anchored on `registers` relationships, while other dependencies show up as cross-links.\n\n" +
    "Use it when you want to answer: _how is this resource connected, who owns it, and who depends on it?_ " +
    "Compared with **Blast Radius**, it is more structure-oriented and less about downstream impact flow.",
};

export function getTopologyLensDescription(view: TopologyViewMode): string {
  return TOPOLOGY_LENS_DESCRIPTIONS[view];
}

export function getTopologyLensLabel(view: TopologyViewMode): string {
  return view === "mindmap" ? "Mindmap" : "Blast Radius";
}
