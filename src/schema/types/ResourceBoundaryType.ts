import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";

export const ResourceBoundaryType: GraphQLObjectType = new GraphQLObjectType({
  name: "ResourceBoundary",
  description:
    "Effective public and private surface for one resource registration subtree.",
  fields: () => ({
    ownerId: {
      description: "Canonical id of the resource owning the boundary.",
      type: new GraphQLNonNull(GraphQLID),
    },
    exportsDeclared: {
      description:
        "True when the resource explicitly declared an isolate exports surface.",
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    declaredExports: {
      description:
        "Canonical ids listed directly by the resource's isolate exports.",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))),
    },
    effectiveExports: {
      description:
        "Canonical ids visible outside the boundary, including definitions reachable through exported resources.",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))),
    },
    privateDefinitions: {
      description:
        "Canonical ids registered inside the boundary but not visible outside it.",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLID))),
    },
  }),
});
