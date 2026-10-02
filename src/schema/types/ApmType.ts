import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLString,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLEnumType,
} from "graphql";
import type {
  ApmSnapshot,
  TaskPerformance,
  HookPerformance,
} from "../../resources/live/apm";
import type { CustomGraphQLContext } from "../context";

export const ApmScopeType = new GraphQLEnumType({
  name: "ApmScope",
  values: {
    all: { value: "all" },
    direct: { value: "direct" },
    nested: { value: "nested" },
  },
});
const performanceFields = {
  count: { type: new GraphQLNonNull(GraphQLInt) },
  failures: { type: new GraphQLNonNull(GraphQLInt) },
  errorRate: { type: new GraphQLNonNull(GraphQLFloat) },
  meanMs: { type: new GraphQLNonNull(GraphQLFloat) },
  p50Ms: { type: new GraphQLNonNull(GraphQLFloat) },
  p95Ms: { type: new GraphQLNonNull(GraphQLFloat) },
  p99Ms: { type: new GraphQLNonNull(GraphQLFloat) },
  maxMs: { type: new GraphQLNonNull(GraphQLFloat) },
};
const TaskPerformanceType = new GraphQLObjectType<TaskPerformance>({
  name: "TaskPerformance",
  fields: {
    taskId: { type: new GraphQLNonNull(GraphQLString) },
    ...performanceFields,
  },
});
const HookPerformanceType = new GraphQLObjectType<HookPerformance>({
  name: "HookPerformance",
  fields: {
    hookId: { type: new GraphQLNonNull(GraphQLString) },
    ...performanceFields,
  },
});
export const ApmType = new GraphQLObjectType<ApmSnapshot, CustomGraphQLContext>(
  {
    name: "ApmSnapshot",
    description:
      "Exact nearest-rank percentiles of retained task and hook completions, grouped separately. Durations include delegated work and overlap.",
    fields: {
      enabled: { type: new GraphQLNonNull(GraphQLBoolean) },
      storage: { type: new GraphQLNonNull(GraphQLString) },
      maxSamples: { type: new GraphQLNonNull(GraphQLInt) },
      maxStorage: { type: GraphQLFloat },
      retainedBytes: { type: GraphQLFloat },
      retainedSamples: { type: new GraphQLNonNull(GraphQLInt) },
      windowMinutes: { type: new GraphQLNonNull(GraphQLInt) },
      scope: { type: new GraphQLNonNull(ApmScopeType) },
      pendingSamples: { type: GraphQLInt },
      persistenceError: { type: GraphQLString },
      cutoffTimestampMs: { type: GraphQLFloat },
      oldestTimestampMs: { type: GraphQLFloat },
      hooks: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(HookPerformanceType))
        ),
      },
      tasks: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(TaskPerformanceType))
        ),
      },
    },
  }
);
