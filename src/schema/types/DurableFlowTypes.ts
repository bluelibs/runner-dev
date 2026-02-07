import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
  type GraphQLFieldConfigMap,
} from "graphql";

// ─── FlowNode Types ──────────────────────────────────────────────────────────

export const FlowStepNodeType = new GraphQLObjectType({
  name: "FlowStepNode",
  description: "A durable workflow step node",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "step",
    },
    stepId: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The step identifier",
    },
    hasCompensation: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Whether this step has a rollback/compensation handler",
    },
  }),
});

export const FlowSleepNodeType = new GraphQLObjectType({
  name: "FlowSleepNode",
  description: "A durable workflow sleep/delay node",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "sleep",
    },
    durationMs: {
      type: new GraphQLNonNull(GraphQLInt),
      description: "Sleep duration in milliseconds",
    },
    stepId: {
      type: GraphQLString,
      description: "Optional explicit step ID",
    },
  }),
});

export const FlowSignalNodeType = new GraphQLObjectType({
  name: "FlowSignalNode",
  description: "A durable workflow signal wait node",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "waitForSignal",
    },
    signalId: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The event ID this step waits for",
    },
    timeoutMs: {
      type: GraphQLInt,
      description: "Optional timeout in milliseconds",
    },
    stepId: {
      type: GraphQLString,
      description: "Optional explicit step ID",
    },
  }),
});

export const FlowEmitNodeType = new GraphQLObjectType({
  name: "FlowEmitNode",
  description: "A durable workflow event emission node",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "emit",
    },
    eventId: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The event ID being emitted",
    },
    stepId: {
      type: GraphQLString,
      description: "Optional explicit step ID",
    },
  }),
});

export const FlowSwitchNodeType = new GraphQLObjectType({
  name: "FlowSwitchNode",
  description: "A durable workflow branching/switch node",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "switch",
    },
    stepId: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The switch step identifier",
    },
    branchIds: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
      description: "IDs of the available branches",
    },
    hasDefault: {
      type: new GraphQLNonNull(GraphQLBoolean),
      description: "Whether a default branch is defined",
    },
  }),
});

export const FlowNoteNodeType = new GraphQLObjectType({
  name: "FlowNoteNode",
  description: "A durable workflow documentation note",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    kind: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => "note",
    },
    message: {
      type: new GraphQLNonNull(GraphQLString),
      description: "The note message",
    },
  }),
});

// ─── FlowNode Union ──────────────────────────────────────────────────────────

export const FlowNodeType = new GraphQLUnionType({
  name: "FlowNode",
  description: "A node in a durable workflow flow description",
  types: [
    FlowStepNodeType,
    FlowSleepNodeType,
    FlowSignalNodeType,
    FlowEmitNodeType,
    FlowSwitchNodeType,
    FlowNoteNodeType,
  ],
  resolveType: (value: { kind: string }) => {
    switch (value.kind) {
      case "step":
        return "FlowStepNode";
      case "sleep":
        return "FlowSleepNode";
      case "waitForSignal":
        return "FlowSignalNode";
      case "emit":
        return "FlowEmitNode";
      case "switch":
        return "FlowSwitchNode";
      case "note":
        return "FlowNoteNode";
      default:
        return undefined;
    }
  },
});

// ─── DurableFlowShape ────────────────────────────────────────────────────────

export const DurableFlowShapeType = new GraphQLObjectType({
  name: "DurableFlowShape",
  description:
    "The structure of a durable workflow, extracted without executing it",
  fields: (): GraphQLFieldConfigMap<unknown, unknown> => ({
    nodes: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(FlowNodeType))
      ),
      description:
        "Ordered list of flow nodes describing the workflow structure",
    },
  }),
});
