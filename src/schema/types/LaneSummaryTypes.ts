import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from "graphql";

export const EventLaneSummaryType = new GraphQLObjectType({
  name: "EventLaneSummary",
  fields: {
    laneId: { type: new GraphQLNonNull(GraphQLString) },
    orderingKey: { type: GraphQLString },
    metadata: { type: GraphQLString },
  },
});

export const RpcLaneSummaryType = new GraphQLObjectType({
  name: "RpcLaneSummary",
  fields: {
    laneId: { type: new GraphQLNonNull(GraphQLString) },
  },
});
