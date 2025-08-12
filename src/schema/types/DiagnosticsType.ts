import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

export const DiagnosticType = new GraphQLObjectType({
  name: "Diagnostic",
  fields: () => ({
    severity: { type: new GraphQLNonNull(GraphQLString) },
    code: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    nodeId: { type: GraphQLID },
    nodeKind: { type: GraphQLString },
  }),
});
