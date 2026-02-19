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
    rootId: {
      description: "The id of the root resource passed to run().",
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});
