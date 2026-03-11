import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

const RunDisposeOptionsType = new GraphQLObjectType({
  name: "RunDisposeOptions",
  description: "Effective shutdown disposal configuration used by run().",
  fields: () => ({
    totalBudgetMs: {
      description:
        "Total shutdown disposal budget in milliseconds. Null when unknown.",
      type: GraphQLFloat,
    },
    drainingBudgetMs: {
      description:
        "Drain wait budget in milliseconds during shutdown. Null when unknown.",
      type: GraphQLFloat,
    },
    cooldownWindowMs: {
      description:
        "Post-cooldown admission window in milliseconds during shutdown. Null when unknown.",
      type: GraphQLFloat,
    },
  }),
});

const RunExecutionContextOptionsType = new GraphQLObjectType({
  name: "RunExecutionContextOptions",
  description: "Effective execution context configuration used by run().",
  fields: () => ({
    enabled: {
      description: "Whether execution context capture is enabled.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    cycleDetection: {
      description:
        "Whether execution-context cycle detection is enabled. Null when disabled or unknown.",
      type: GraphQLBoolean,
    },
  }),
});

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
    lifecycleMode: {
      description:
        'Startup/disposal scheduler mode: "sequential" or "parallel".',
      type: new GraphQLNonNull(GraphQLString),
    },
    dispose: {
      description: "Effective shutdown disposal configuration.",
      type: new GraphQLNonNull(RunDisposeOptionsType),
    },
    executionContext: {
      description: "Effective execution context configuration.",
      type: new GraphQLNonNull(RunExecutionContextOptionsType),
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
