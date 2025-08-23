import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLID,
} from "graphql";

export const SwapResultType = new GraphQLObjectType({
  name: "SwapResult",
  fields: () => ({
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
    taskId: { type: new GraphQLNonNull(GraphQLString) },
  }),
});

export const SwappedTaskType = new GraphQLObjectType({
  name: "SwappedTask",
  fields: () => ({
    taskId: { type: new GraphQLNonNull(GraphQLString) },
    swappedAt: { type: new GraphQLNonNull(GraphQLFloat) },
    originalCode: { type: GraphQLString },
  }),
});

export const InvokeResultType = new GraphQLObjectType({
  name: "InvokeResult",
  fields: () => ({
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
    taskId: { type: new GraphQLNonNull(GraphQLString) },
    result: { type: GraphQLString },
    executionTimeMs: { type: GraphQLFloat },
    invocationId: { type: GraphQLString },
  }),
});

export const InvokeEventResultType = new GraphQLObjectType({
  name: "InvokeEventResult",
  fields: () => ({
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
    executionTimeMs: { type: GraphQLFloat },
    invocationId: { type: GraphQLString },
  }),
});

export const EvalResultType = new GraphQLObjectType({
  name: "EvalResult",
  fields: () => ({
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
    result: { type: GraphQLString },
    executionTimeMs: { type: GraphQLFloat },
    invocationId: { type: GraphQLString },
  }),
});
