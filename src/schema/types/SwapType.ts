import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
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

export const ShellResultType = new GraphQLObjectType({
  name: "ShellResult",
  fields: () => ({
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
    error: { type: GraphQLString },
    result: { type: GraphQLString },
    logs: { type: new GraphQLList(GraphQLString) },
    executionTimeMs: { type: GraphQLFloat },
    invocationId: { type: GraphQLString },
  }),
});

export const ShellCompletionOptionType = new GraphQLObjectType({
  name: "ShellCompletionOption",
  fields: () => ({
    label: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    detail: { type: GraphQLString },
  }),
});

export const ShellCompletionType = new GraphQLObjectType({
  name: "ShellCompletion",
  fields: () => ({
    from: { type: new GraphQLNonNull(GraphQLFloat) },
    options: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ShellCompletionOptionType))
      ),
    },
  }),
});
