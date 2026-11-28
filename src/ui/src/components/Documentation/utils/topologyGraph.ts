import {
  type AsyncContext as AsyncContextModel,
  type Error as ErrorModel,
  type Event,
  type Hook,
  type Middleware,
  type Resource,
  type Tag,
  type Task,
} from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { ensureStringArray } from "../../../../../resources/models/introspector.tools";
import { formatId } from "./formatting";
import { getDocumentationIcon } from "../config/documentationIcons";
import { isSystemElement } from "./isSystemElement";
import {
  DEFAULT_TOPOLOGY_RADIUS,
  MAX_TOPOLOGY_RADIUS,
  getDefaultTopologyFocus,
} from "./topologyGraph.state";
export {
  DEFAULT_TOPOLOGY_RADIUS,
  TOPOLOGY_STORAGE_KEY,
  buildTopologyHash,
  defaultViewForKind,
  getDefaultTopologyFocus,
  getDefaultTopologyState,
  openTopologyFocus,
  parseTopologyHash,
} from "./topologyGraph.state";

export type TopologyFocusKind =
  | "task"
  | "resource"
  | "hook"
  | "event"
  | "middleware"
  | "error"
  | "asyncContext"
  | "tag";

export type TopologyViewMode = "blast" | "mindmap";

export type TopologyEdgeKind =
  | "depends-on"
  | "emits"
  | "listens-to"
  | "listened-to-by"
  | "registers"
  | "registered-by"
  | "uses-middleware"
  | "overrides"
  | "thrown-by"
  | "provided-by"
  | "required-by"
  | "used-by"
  | "tagged"
  | "emitted-by";

export interface TopologyFocus {
  kind: TopologyFocusKind;
  id: string;
}

export interface TopologyHashState {
  radius?: number;
  why?: string;
  owner?: string;
  paths?: boolean;
  focus: TopologyFocus | null;
  view: TopologyViewMode;
}

export interface TopologyProjectionOptions {
  focusId?: string | null;
  focusKind?: TopologyFocusKind | null;
  view: TopologyViewMode;
  radius: number;
  visibleIds?: Set<string> | null;
}

interface BaseDescriptor {
  id: string;
  kind: TopologyFocusKind;
  title: string;
  subtitle: string;
  description?: string | null;
  filePath?: string | null;
  icon: string;
  visibility: "public" | "private" | "system";
  pills: string[];
}

interface TraversalRelation {
  kind: TopologyEdgeKind;
  targets: BaseDescriptor[];
  /**
   * Terminal contract edge (blast lens only): the target shares a contract
   * with the source (emitter, thrower, provider) but does not propagate its
   * changes further, so traversal records the edge without expanding it.
   */
  terminal?: boolean;
}

interface TopologyNodeRecord extends BaseDescriptor {
  depth: number;
  order: number;
  parentId: string | null;
  parentRelationKind: TopologyEdgeKind | null;
  isFocus: boolean;
  isVisible: boolean;
  terminal: boolean;
  incomingIds: Set<string>;
  outgoingIds: Set<string>;
  hiddenIds: Set<string>;
}

export interface TopologyGraphNode {
  id: string;
  kind: TopologyFocusKind;
  label: string;
  subtitle: string;
  description?: string | null;
  filePath?: string | null;
  icon: string;
  depth: number;
  order: number;
  parentId: string | null;
  parentRelationKind: TopologyEdgeKind | null;
  isFocus: boolean;
  isVisible: boolean;
  /** Reached via a terminal contract edge: shares a contract, not downstream. */
  terminal: boolean;
  hiddenNeighborCount: number;
  incomingCount: number;
  outgoingCount: number;
  visibility: "public" | "private" | "system";
  pills: string[];
}

export interface TopologyGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: TopologyEdgeKind;
  isPrimary: boolean;
  isCrossLink: boolean;
}

export interface TopologyGraphProjection {
  focus: TopologyFocus;
  view: TopologyViewMode;
  radius: number;
  nodes: TopologyGraphNode[];
  edges: TopologyGraphEdge[];
  selectedNode: TopologyGraphNode;
  hiddenNodeCount: number;
  summary: {
    visibleNodes: number;
    visibleEdges: number;
    hiddenNodes: number;
  };
}

export function collectSearchTopologyVisibleIds(
  nodes: TopologyGraphNode[],
  selectedNodeId: string,
  matchingIds: Set<string>
): Set<string> {
  if (matchingIds.size <= 1) {
    return new Set([selectedNodeId]);
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const visibleIds = new Set<string>([selectedNodeId]);

  for (const matchId of matchingIds) {
    let current = nodesById.get(matchId) ?? null;
    while (current) {
      visibleIds.add(current.id);
      current = current.parentId
        ? nodesById.get(current.parentId) ?? null
        : null;
    }
  }

  return visibleIds;
}

export interface TopologyResolvedNode extends BaseDescriptor {
  element:
    | Task
    | Resource
    | Hook
    | Event
    | Middleware
    | ErrorModel
    | AsyncContextModel
    | Tag;
}

export function buildTopologyProjection(
  introspector: Introspector,
  options: TopologyProjectionOptions
): TopologyGraphProjection {
  const focus = resolveFocus(introspector, options.focusId, options.focusKind);
  const state = {
    focus,
    view: options.view,
    radius: Math.max(
      1,
      Math.min(
        MAX_TOPOLOGY_RADIUS,
        Math.round(options.radius || DEFAULT_TOPOLOGY_RADIUS)
      )
    ),
  };
  const visibleIds = options.visibleIds ?? null;

  const queue: Array<{
    kind: TopologyFocusKind;
    id: string;
    depth: number;
    parentId: string | null;
    relationKind: TopologyEdgeKind | null;
    terminal: boolean;
    order: number;
  }> = [];
  const queuedReach = new Map<string, TraversalReach>();
  const nodeRecords = new Map<string, TopologyNodeRecord>();
  const edges = new Map<string, TopologyGraphEdge>();
  const hiddenIds = new Set<string>();
  let order = 0;

  queue.push({
    kind: focus.kind,
    id: focus.id,
    depth: 0,
    parentId: null,
    relationKind: null,
    terminal: false,
    order,
  });
  queuedReach.set(focus.id, "downstream");

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (!current) continue;

    const descriptor = resolveNodeDescriptor(
      introspector,
      current.id,
      current.kind
    );
    if (!descriptor) continue;

    const isVisible =
      visibleIds === null ||
      visibleIds.has(descriptor.id) ||
      descriptor.id === focus.id;
    const shouldIncludeRegisters =
      state.view === "mindmap" && focus.kind === "resource";
    // Terminal contract nodes get a record (so the edge renders) but never
    // expand: their neighbors are not affected by the focus.
    const relations =
      current.terminal ||
      (state.view === "blast" && current.depth >= state.radius)
        ? []
        : getTraversalRelations(introspector, descriptor, {
            includeRegisters: shouldIncludeRegisters,
            impact: state.view === "blast",
            includeContract: state.view === "blast" && current.depth === 0,
          });

    // Each dequeue is a first visit or a contract partner upgraded by a later
    // downstream reach (see shouldEnqueueReach); both take this entry's place.
    const node = nodeRecords.get(descriptor.id) ?? createNodeRecord(descriptor);
    node.depth = current.depth;
    node.order = current.order;
    node.parentId = current.parentId;
    node.parentRelationKind = current.relationKind;
    node.isFocus = descriptor.id === focus.id;
    node.isVisible = isVisible;
    node.terminal = current.terminal;
    nodeRecords.set(descriptor.id, node);

    for (const relation of relations) {
      for (const target of relation.targets) {
        if (target.id === descriptor.id) continue;

        if (
          visibleIds !== null &&
          !visibleIds.has(target.id) &&
          target.id !== focus.id
        ) {
          node.hiddenIds.add(target.id);
          hiddenIds.add(target.id);
        }

        const edgeId = `${descriptor.id}::${relation.kind}::${target.id}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            sourceId: descriptor.id,
            targetId: target.id,
            kind: relation.kind,
            isPrimary: false,
            isCrossLink:
              current.parentId !== descriptor.id ||
              current.relationKind !== relation.kind,
          });
        }

        const nextDepth = current.depth + 1;
        const reach: TraversalReach =
          relation.terminal === true ? "terminal" : "downstream";
        if (
          nextDepth <= state.radius &&
          shouldEnqueueReach(queuedReach.get(target.id), reach)
        ) {
          queuedReach.set(target.id, reach);
          queue.push({
            kind: target.kind,
            id: target.id,
            depth: nextDepth,
            parentId: descriptor.id,
            relationKind: relation.kind,
            terminal: reach === "terminal",
            order: ++order,
          });
        }

        node.outgoingIds.add(target.id);
      }
    }
  }

  // Gather incoming counts and edge directions.
  for (const edge of edges.values()) {
    const source = nodeRecords.get(edge.sourceId);
    const target = nodeRecords.get(edge.targetId);
    if (source) {
      source.outgoingIds.add(edge.targetId);
    }
    if (target) {
      target.incomingIds.add(edge.sourceId);
    }
  }

  for (const edge of edges.values()) {
    const target = nodeRecords.get(edge.targetId);
    const isMindmapResourceFocus =
      state.view === "mindmap" && focus.kind === "resource";
    const isPrimaryTreeEdge =
      Boolean(target) &&
      target?.parentId === edge.sourceId &&
      target?.parentRelationKind === edge.kind &&
      (!isMindmapResourceFocus || edge.kind === "registers");

    edge.isPrimary = isPrimaryTreeEdge;
    edge.isCrossLink = !isPrimaryTreeEdge;
  }

  const nodeList = [...nodeRecords.values()];
  const visibleNodes = nodeList.filter((node) => node.isVisible).length;
  const visibleEdges = [...edges.values()].filter((edge) => {
    const source = nodeRecords.get(edge.sourceId);
    const target = nodeRecords.get(edge.targetId);
    return Boolean(source?.isVisible && target?.isVisible);
  }).length;

  const normalizedNodes = nodeList
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.title,
      subtitle: node.subtitle,
      description: node.description,
      filePath: node.filePath,
      icon: node.icon,
      depth: node.depth,
      order: node.order,
      parentId: node.parentId,
      parentRelationKind: node.parentRelationKind,
      isFocus: node.isFocus,
      isVisible: node.isVisible,
      terminal: node.terminal,
      hiddenNeighborCount: node.hiddenIds.size,
      incomingCount: node.incomingIds.size,
      outgoingCount: node.outgoingIds.size,
      visibility: node.visibility,
      pills: node.pills,
    }));

  const selectedNode =
    normalizedNodes.find((node) => node.id === focus.id) ??
    normalizedNodes[0] ??
    createFallbackNode(focus);

  return {
    focus,
    view: state.view,
    radius: state.radius,
    nodes: normalizedNodes,
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    selectedNode,
    hiddenNodeCount: hiddenIds.size,
    summary: {
      visibleNodes,
      visibleEdges,
      hiddenNodes: hiddenIds.size,
    },
  };
}

/**
 * How traversal reached a node. Breadth-first order makes the first
 * downstream reach the shallowest one, so a node is enqueued at most twice:
 * once as a terminal contract partner, and once more when a real downstream
 * edge reaches it later — it is affected after all and must expand.
 * Nothing downgrades a downstream node back to terminal.
 */
type TraversalReach = "downstream" | "terminal";

function shouldEnqueueReach(
  previous: TraversalReach | undefined,
  next: TraversalReach
): boolean {
  return (
    previous === undefined || (previous === "terminal" && next === "downstream")
  );
}

function createNodeRecord(descriptor: BaseDescriptor): TopologyNodeRecord {
  return {
    ...descriptor,
    depth: 0,
    order: 0,
    parentId: null,
    parentRelationKind: null,
    isFocus: false,
    isVisible: true,
    terminal: false,
    incomingIds: new Set<string>(),
    outgoingIds: new Set<string>(),
    hiddenIds: new Set<string>(),
  };
}

function createFallbackNode(focus: TopologyFocus): TopologyGraphNode {
  return {
    id: focus.id,
    kind: focus.kind,
    label: formatId(focus.id),
    subtitle: focus.id,
    icon: getDocumentationIcon(focus.kind),
    depth: 0,
    order: 0,
    parentId: null,
    parentRelationKind: null,
    isFocus: true,
    isVisible: true,
    terminal: false,
    hiddenNeighborCount: 0,
    incomingCount: 0,
    outgoingCount: 0,
    visibility: "public",
    pills: [],
  };
}

interface TraversalFlags {
  includeRegisters: boolean;
  /** Blast lens: follow dependents-only (downstream impact) relations. */
  impact: boolean;
  /**
   * Depth-0 only: include terminal contract partners (emitters, throwers,
   * providers). Deeper contract edges would be false positives — the
   * intermediate node's type is unchanged, only its behavior.
   */
  includeContract: boolean;
}

export function directTopologyRelations(
  source: Introspector,
  focus: TopologyFocus
) {
  const node = resolveNodeDescriptor(source, focus.id, focus.kind);
  if (!node) return [];
  const relations = getTraversalRelations(source, node, {
    includeRegisters: true,
    impact: false,
    includeContract: false,
  });
  if (node.kind === "task" || node.kind === "hook" || node.kind === "tag") {
    relations.push({
      kind: "used-by",
      targets: resolveMany(source, getImpactDependents(source, node.id)),
    });
  }
  return dedupeRelations(relations);
}

function getTraversalRelations(
  introspector: Introspector,
  descriptor: TopologyResolvedNode,
  flags: TraversalFlags
): TraversalRelation[] {
  if (flags.impact) {
    return getImpactRelations(introspector, descriptor, flags.includeContract);
  }

  const element = descriptor.element;
  const relations: TraversalRelation[] = [];
  const includeRegisters = flags.includeRegisters;

  if (descriptor.kind === "task") {
    const task = element as Task;
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "depends-on",
      targets: resolveMany(introspector, task.dependsOn),
    });
    relations.push({
      kind: "emits",
      targets: resolveMany(introspector, task.emits),
    });
    relations.push({
      kind: "uses-middleware",
      targets: resolveMany(introspector, task.middleware),
    });
    if (task.durableResourceId) {
      relations.push({
        kind: "depends-on",
        targets: resolveMany(introspector, [task.durableResourceId]),
      });
    }
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "resource") {
    const resource = element as Resource;
    appendRegisteredByRelation(introspector, element, relations);
    if (includeRegisters) {
      relations.push({
        kind: "registers",
        targets: resolveMany(introspector, resource.registers),
      });
    }
    relations.push({
      kind: "depends-on",
      targets: resolveMany(introspector, resource.dependsOn),
    });
    relations.push({
      kind: "used-by",
      targets: resolveMany(
        introspector,
        getImpactDependents(introspector, resource.id)
      ),
    });
    relations.push({
      kind: "uses-middleware",
      targets: resolveMany(introspector, resource.middleware),
    });
    relations.push({
      kind: "emits",
      targets: resolveMany(introspector, resource.emits),
    });
    relations.push({
      kind: "overrides",
      targets: resolveMany(introspector, resource.overrides),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "hook") {
    const hook = element as Hook & { middleware?: string[] | null };
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "listens-to",
      targets: resolveMany(introspector, hook.events),
    });
    relations.push({
      kind: "depends-on",
      targets: resolveMany(introspector, hook.dependsOn),
    });
    relations.push({
      kind: "emits",
      targets: resolveMany(introspector, hook.emits),
    });
    relations.push({
      kind: "uses-middleware",
      targets: resolveMany(introspector, hook.middleware ?? []),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "event") {
    const event = element as Event;
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "listened-to-by",
      targets: resolveMany(introspector, event.listenedToBy),
    });
    relations.push({
      kind: "emitted-by",
      targets: resolveMany(introspector, getEmitterIds(introspector, event.id)),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "middleware") {
    appendRegisteredByRelation(introspector, element, relations);
    relations.push(
      ...getMiddlewareRelations(introspector, element as Middleware)
    );
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "error") {
    const error = element as ErrorModel;
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "thrown-by",
      targets: resolveMany(introspector, error.thrownBy),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "asyncContext") {
    const context = element as AsyncContextModel;
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "provided-by",
      targets: resolveMany(introspector, context.providedBy),
    });
    relations.push({
      kind: "required-by",
      targets: resolveMany(introspector, context.requiredBy),
    });
    relations.push({
      kind: "used-by",
      targets: resolveMany(introspector, context.usedBy),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "tag") {
    const tag = element as Tag;
    appendRegisteredByRelation(introspector, element, relations);
    relations.push({
      kind: "tagged",
      targets: resolveMany(introspector, getTaggedElementIds(tag)),
    });
    return dedupeRelations(relations);
  }

  return relations;
}

/**
 * A middleware's own neighborhood, the same in both lenses: the nodes it
 * wraps (`used-by`) and the events it emits itself through its own event
 * dependencies (`emits`). The wrapped nodes' events are reached one hop
 * later through those nodes. GraphQL `Middleware.emits` and the card's
 * "Events Emitted by Usage" aggregate exactly those wrapped-node events, so
 * folding them in here would draw emit edges the middleware never fires and
 * place those events a hop too shallow in the blast radius.
 */
function getMiddlewareRelations(
  introspector: Introspector,
  middleware: Middleware
): TraversalRelation[] {
  return [
    {
      kind: "used-by",
      targets: resolveMany(introspector, [
        ...middleware.usedByTasks,
        ...middleware.usedByResources,
      ]),
    },
    {
      kind: "emits",
      targets: resolveMany(introspector, ensureStringArray(middleware.emits)),
    },
  ];
}

/** Every element carrying the tag, whatever its kind. */
function getTaggedElementIds(tag: Tag): string[] {
  return [
    ...tag.tasks,
    ...tag.hooks,
    ...tag.resources,
    ...tag.events,
    ...tag.taskMiddlewares,
    ...tag.resourceMiddlewares,
    ...tag.errors,
  ].map((item) => item.id);
}

/**
 * Dependents-only relations for the blast lens: "what behaves differently
 * if this node changes". Ownership (`registered-by`, `registers`) and
 * upstream edges (`depends-on`, `uses-middleware`, `listens-to`,
 * `provided-by`) are excluded — the mindmap lens keeps the full
 * neighborhood. A tag reaches both the elements depending on it and the
 * elements carrying it (`tagged`): a tag config/schema change lands on
 * every carrier. Override propagation is a known gap: consumers of an
 * overridden base execute the winner's code but are not listed yet.
 */
function getImpactRelations(
  introspector: Introspector,
  descriptor: TopologyResolvedNode,
  includeContract: boolean
): TraversalRelation[] {
  const element = descriptor.element;
  const relations: TraversalRelation[] = [];

  if (
    descriptor.kind === "task" ||
    descriptor.kind === "resource" ||
    descriptor.kind === "hook"
  ) {
    relations.push({
      kind: "used-by",
      targets: resolveMany(
        introspector,
        getImpactDependents(introspector, descriptor.id)
      ),
    });
    relations.push({
      kind: "emits",
      targets: resolveMany(
        introspector,
        (element as Task | Resource | Hook).emits
      ),
    });
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "event") {
    const event = element as Event;
    relations.push({
      kind: "listened-to-by",
      targets: resolveMany(introspector, event.listenedToBy),
    });
    if (includeContract) {
      relations.push({
        kind: "emitted-by",
        targets: resolveMany(
          introspector,
          getEmitterIds(introspector, event.id)
        ),
        terminal: true,
      });
    }
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "middleware") {
    relations.push(
      ...getMiddlewareRelations(introspector, element as Middleware)
    );
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "error") {
    if (includeContract) {
      const error = element as ErrorModel;
      relations.push({
        kind: "thrown-by",
        targets: resolveMany(introspector, error.thrownBy),
        terminal: true,
      });
    }
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "asyncContext") {
    const context = element as AsyncContextModel;
    relations.push({
      kind: "used-by",
      targets: resolveMany(introspector, context.usedBy),
    });
    relations.push({
      kind: "required-by",
      targets: resolveMany(introspector, context.requiredBy),
    });
    if (includeContract) {
      relations.push({
        kind: "provided-by",
        targets: resolveMany(introspector, context.providedBy),
        terminal: true,
      });
    }
    return dedupeRelations(relations);
  }

  if (descriptor.kind === "tag") {
    relations.push({
      kind: "used-by",
      targets: resolveMany(
        introspector,
        getImpactDependents(introspector, descriptor.id)
      ),
    });
    relations.push({
      kind: "tagged",
      targets: resolveMany(introspector, getTaggedElementIds(element as Tag)),
    });
    return dedupeRelations(relations);
  }

  return relations;
}

function taskHookResources(source: Introspector) {
  return [...source.getTasks(), ...source.getHooks(), ...source.getResources()];
}

function getEmitterIds(source: Introspector, eventId: string) {
  return taskHookResources(source)
    .filter((item) => ensureStringArray(item.emits).includes(eventId))
    .map((item) => item.id);
}

/**
 * Reverse dependency scan: tasks/hooks/resources that would behave
 * differently if `id` changed, including durable-resource users.
 */
function getImpactDependents(introspector: Introspector, id: string): string[] {
  const dependentIds = new Set<string>();
  for (const item of taskHookResources(introspector)) {
    if (
      item.id !== id &&
      (ensureStringArray(item.dependsOn).includes(id) ||
        ("durableResourceId" in item && item.durableResourceId === id))
    ) {
      dependentIds.add(item.id);
    }
  }
  return Array.from(dependentIds);
}

function appendRegisteredByRelation(
  introspector: Introspector,
  element: TopologyResolvedNode["element"],
  relations: TraversalRelation[]
): void {
  const registeredBy = getRegisteredById(element);
  if (!registeredBy) return;

  relations.push({
    kind: "registered-by",
    targets: resolveMany(introspector, [registeredBy], "resource"),
  });
}

function getRegisteredById(
  element: TopologyResolvedNode["element"]
): string | null {
  if (!("registeredBy" in element)) return null;

  const registeredBy = element.registeredBy;
  return typeof registeredBy === "string" && registeredBy.length > 0
    ? registeredBy
    : null;
}

function dedupeRelations(relations: TraversalRelation[]): TraversalRelation[] {
  const seen = new Set<string>();
  const output: TraversalRelation[] = [];
  for (const relation of relations) {
    const targets = relation.targets.filter((target) => {
      if (seen.has(`${relation.kind}:${target.id}`)) return false;
      seen.add(`${relation.kind}:${target.id}`);
      return true;
    });
    if (targets.length > 0) {
      output.push({
        kind: relation.kind,
        targets,
        ...(relation.terminal === true ? { terminal: true as const } : {}),
      });
    }
  }
  return output;
}

function resolveMany(
  introspector: Introspector,
  ids: string[],
  kind?: TopologyFocusKind
): BaseDescriptor[] {
  const result: BaseDescriptor[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const descriptor = resolveNodeDescriptor(introspector, id, kind);
    if (!descriptor || seen.has(descriptor.id)) continue;
    seen.add(descriptor.id);
    result.push(descriptor);
  }
  return result;
}

function findExactKind(
  source: Introspector,
  id: string
): TopologyFocusKind | undefined {
  if (source.taskMap.has(id)) return "task";
  if (source.resourceMap.has(id)) return "resource";
  if (source.hookMap.has(id)) return "hook";
  if (source.eventMap.has(id)) return "event";
  if (source.middlewareMap.has(id)) return "middleware";
  if (source.errorMap.has(id)) return "error";
  if (source.asyncContextMap.has(id)) return "asyncContext";
  if (source.tagMap.has(id)) return "tag";
  return undefined;
}

function resolveNodeDescriptor(
  introspector: Introspector,
  id: string,
  requestedKind?: TopologyFocusKind | null
): TopologyResolvedNode | null {
  const kind = requestedKind ?? findExactKind(introspector, id);
  const task = (!kind || kind === "task") && introspector.getTask(id);
  if (task) return { ...describeTask(task), element: task };

  const resource =
    (!kind || kind === "resource") && introspector.getResource(id);
  if (resource) return { ...describeResource(resource), element: resource };

  const hook = (!kind || kind === "hook") && introspector.getHook(id);
  if (hook) return { ...describeHook(hook), element: hook };

  const event = (!kind || kind === "event") && introspector.getEvent(id);
  if (event) return { ...describeEvent(event), element: event };

  const middleware =
    (!kind || kind === "middleware") && introspector.getMiddleware(id);
  if (middleware)
    return { ...describeMiddleware(middleware), element: middleware };

  const error = (!kind || kind === "error") && introspector.getError(id);
  if (error) return { ...describeError(error), element: error };

  const context =
    (!kind || kind === "asyncContext") && introspector.getAsyncContext(id);
  if (context) return { ...describeAsyncContext(context), element: context };

  const tag = (!kind || kind === "tag") && introspector.getTag(id);
  if (tag) return { ...describeTag(tag), element: tag };

  return null;
}

export function resolveFocus(
  introspector: Introspector,
  focusId?: string | null,
  focusKind?: TopologyFocusKind | null
): TopologyFocus {
  if (focusId) {
    // Canonicalize: a hand-written hash may name the focus by a short id
    // that the introspector resolves by suffix, while traversal records
    // nodes under canonical ids. A raw id would let a cycle back to the
    // focus re-record it as a child of its own neighbor.
    const descriptor = resolveNodeDescriptor(introspector, focusId, focusKind);
    if (descriptor) {
      return { kind: descriptor.kind, id: descriptor.id };
    }
    if (focusKind) return { kind: focusKind, id: focusId };
  }

  const fallback = getDefaultTopologyFocus(introspector);
  if (fallback) return fallback;

  return {
    kind: "resource",
    id: "topology.root",
  };
}

function describeTask(task: Task): BaseDescriptor {
  const pills: string[] = [];
  if (task.isDurable) pills.push("durable");
  if (task.rpcLane?.laneId) pills.push(`rpc:${task.rpcLane.laneId}`);
  if (typeof task.interceptorCount === "number" && task.interceptorCount > 0) {
    pills.push(`interceptors:${task.interceptorCount}`);
  }
  if (task.isPrivate) pills.push("private");
  if (!task.isPrivate) pills.push("public");

  return {
    id: task.id,
    kind: "task",
    title: task.meta?.title || formatId(task.id),
    subtitle: task.id,
    description: task.meta?.description ?? null,
    filePath: task.filePath ?? null,
    icon: getDocumentationIcon("task"),
    visibility: isSystemElement(task)
      ? "system"
      : task.isPrivate
      ? "private"
      : "public",
    pills,
  };
}

function describeResource(resource: Resource): BaseDescriptor {
  const pills: string[] = [];
  if (resource.isolation) {
    pills.push(`exports:${resource.isolation.exportsMode}`);
  }
  if (resource.subtree) pills.push("subtree");
  if (resource.hasReady) pills.push("ready");
  if (resource.hasCooldown) pills.push("cooldown");
  if (resource.hasHealthCheck) pills.push("health");
  if (resource.context) pills.push(`ctx:${resource.context}`);
  if (resource.isPrivate) pills.push("private");
  if (!resource.isPrivate) pills.push("public");

  return {
    id: resource.id,
    kind: "resource",
    title: resource.meta?.title || formatId(resource.id),
    subtitle: resource.id,
    description: resource.meta?.description ?? null,
    filePath: resource.filePath ?? null,
    icon: getDocumentationIcon("resource"),
    visibility: isSystemElement(resource)
      ? "system"
      : resource.isPrivate
      ? "private"
      : "public",
    pills,
  };
}

function describeHook(hook: Hook): BaseDescriptor {
  const pills: string[] = [];
  if (typeof hook.hookOrder === "number") pills.push(`order:${hook.hookOrder}`);
  if (hook.events.includes("*")) pills.push("global");
  if (hook.isPrivate) pills.push("private");
  if (!hook.isPrivate) pills.push("public");

  return {
    id: hook.id,
    kind: "hook",
    title: hook.meta?.title || formatId(hook.id),
    subtitle: hook.id,
    description: hook.meta?.description ?? null,
    filePath: hook.filePath ?? null,
    icon: getDocumentationIcon("hook"),
    visibility: isSystemElement(hook)
      ? "system"
      : hook.isPrivate
      ? "private"
      : "public",
    pills,
  };
}

function describeEvent(event: Event): BaseDescriptor {
  const pills: string[] = [];
  if (event.transactional) pills.push("transactional");
  if (event.parallel) pills.push("parallel");
  if (event.eventLane?.laneId) pills.push(`lane:${event.eventLane.laneId}`);
  if (event.rpcLane?.laneId) pills.push(`rpc:${event.rpcLane.laneId}`);

  return {
    id: event.id,
    kind: "event",
    title: event.meta?.title || formatId(event.id),
    subtitle: event.id,
    description: event.meta?.description ?? null,
    filePath: event.filePath ?? null,
    icon: getDocumentationIcon("event"),
    visibility: isSystemElement(event) ? "system" : "public",
    pills,
  };
}

function describeMiddleware(middleware: Middleware): BaseDescriptor {
  const pills: string[] = [];
  if (middleware.autoApply?.enabled) {
    pills.push(`auto:${middleware.autoApply.scope || "where-visible"}`);
  }
  if (middleware.type) pills.push(middleware.type);

  return {
    id: middleware.id,
    kind: "middleware",
    title: middleware.meta?.title || formatId(middleware.id),
    subtitle: middleware.id,
    description: middleware.meta?.description ?? null,
    filePath: middleware.filePath ?? null,
    icon: getDocumentationIcon("middleware"),
    visibility: isSystemElement(middleware)
      ? "system"
      : middleware.isPrivate
      ? "private"
      : "public",
    pills,
  };
}

function describeError(error: ErrorModel): BaseDescriptor {
  return {
    id: error.id,
    kind: "error",
    title: error.meta?.title || formatId(error.id),
    subtitle: error.id,
    description: error.meta?.description ?? null,
    filePath: error.filePath ?? null,
    icon: getDocumentationIcon("error"),
    visibility: isSystemElement(error)
      ? "system"
      : error.isPrivate
      ? "private"
      : "public",
    pills: isSystemElement(error)
      ? ["system"]
      : error.isPrivate
      ? ["private"]
      : ["public"],
  };
}

function describeAsyncContext(context: AsyncContextModel): BaseDescriptor {
  const pills: string[] = [];
  if (context.providedBy.length > 0)
    pills.push(`provided:${context.providedBy.length}`);
  if (context.requiredBy.length > 0)
    pills.push(`required:${context.requiredBy.length}`);
  if (context.usedBy.length > 0) pills.push(`used:${context.usedBy.length}`);

  return {
    id: context.id,
    kind: "asyncContext",
    title: context.meta?.title || formatId(context.id),
    subtitle: context.id,
    description: context.meta?.description ?? null,
    filePath: context.filePath ?? null,
    icon: getDocumentationIcon("asyncContext"),
    visibility: isSystemElement(context)
      ? "system"
      : context.isPrivate
      ? "private"
      : "public",
    pills: isSystemElement(context)
      ? ["system", ...pills]
      : context.isPrivate
      ? ["private", ...pills]
      : ["public", ...pills],
  };
}

function describeTag(tag: Tag): BaseDescriptor {
  const pills: string[] = [];
  if (tag.targets?.length) pills.push(`targets:${tag.targets.length}`);

  return {
    id: tag.id,
    kind: "tag",
    title: tag.meta?.title || formatId(tag.id),
    subtitle: tag.id,
    description: tag.meta?.description ?? null,
    filePath: tag.filePath ?? null,
    icon: getDocumentationIcon("tag"),
    visibility: isSystemElement(tag)
      ? "system"
      : tag.isPrivate
      ? "private"
      : "public",
    pills: isSystemElement(tag)
      ? ["system", ...pills]
      : tag.isPrivate
      ? ["private", ...pills]
      : ["public", ...pills],
  };
}
