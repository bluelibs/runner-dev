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
import type { ApmSnapshot, TaskPerformance } from "../../resources/live/apm";
import type { CustomGraphQLContext } from "../context";

export const ApmScopeType = new GraphQLEnumType({
  name: "ApmScope",
  values: {
    all: { value: "all" },
    direct: { value: "direct" },
    nested: { value: "nested" },
  },
});
const TaskPerformanceType = new GraphQLObjectType<TaskPerformance>({
  name: "TaskPerformance",
  fields: {
    taskId: { type: new GraphQLNonNull(GraphQLString) },
    count: { type: new GraphQLNonNull(GraphQLInt) },
    failures: { type: new GraphQLNonNull(GraphQLInt) },
    errorRate: { type: new GraphQLNonNull(GraphQLFloat) },
    meanMs: { type: new GraphQLNonNull(GraphQLFloat) },
    p50Ms: { type: new GraphQLNonNull(GraphQLFloat) },
    p95Ms: { type: new GraphQLNonNull(GraphQLFloat) },
    p99Ms: { type: new GraphQLNonNull(GraphQLFloat) },
    maxMs: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});
export const ApmType = new GraphQLObjectType<ApmSnapshot, CustomGraphQLContext>(
  {
    name: "ApmSnapshot",
    description:
      "Exact nearest-rank percentiles of retained task completions. Durations include nested work; hooks are excluded.",
    fields: {
      enabled: { type: new GraphQLNonNull(GraphQLBoolean) },
      storage: { type: new GraphQLNonNull(GraphQLString) },
      maxSamples: { type: new GraphQLNonNull(GraphQLInt) },
      retainedSamples: { type: new GraphQLNonNull(GraphQLInt) },
      windowMinutes: { type: new GraphQLNonNull(GraphQLInt) },
      scope: { type: new GraphQLNonNull(ApmScopeType) },
      oldestTimestampMs: { type: GraphQLFloat },
      tasks: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(TaskPerformanceType))
        ),
      },
    },
  }
);
