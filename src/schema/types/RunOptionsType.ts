import {
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

export const RunOptionsType = new GraphQLObjectType({
  name: "RunOptions",
  description:
    "Effective run options that were used when starting the application via run().",
  fields: () => ({
    mode: {
      description:
        'The mode in which the runner is operating: "dev", "prod", or "test".',
      type: new GraphQLNonNull(GraphQLString),
    },
    debug: {
      description:
        "Whether the debug resource was enabled at startup. True when run() received a debug option.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    debugMode: {
      description:
        'High-level debug mode summary: "normal", "verbose", "custom", or "disabled".',
      type: GraphQLString,
    },
    logsEnabled: {
      description:
        "Whether logger output is printed. False when printThreshold is null.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    logsPrintThreshold: {
      description: "Effective logger print threshold, or null when disabled.",
      type: GraphQLString,
    },
    logsPrintStrategy: {
      description: "Effective logger print strategy when available.",
      type: GraphQLString,
    },
    logsBuffer: {
      description: "Whether the logger buffers logs in memory.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    errorBoundary: {
      description:
        "Whether process-level error boundaries are enabled. Null when unknown.",
      type: GraphQLBoolean,
    },
    shutdownHooks: {
      description:
        "Whether SIGINT/SIGTERM shutdown hooks are enabled. Null when unknown.",
      type: GraphQLBoolean,
    },
    dryRun: {
      description: "Whether startup runs in dry-run mode.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    lazy: {
      description: "Whether lazy resource mode is enabled.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    initMode: {
      description: 'Startup scheduler mode: "sequential" or "parallel".',
      type: new GraphQLNonNull(GraphQLString),
    },
    runtimeEventCycleDetection: {
      description:
        "Whether runtime event cycle detection is enabled. Null when unknown.",
      type: GraphQLBoolean,
    },
    hasOnUnhandledError: {
      description: "Presence flag for an onUnhandledError callback.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    rootId: {
      description: "The id of the root resource passed to run().",
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});
