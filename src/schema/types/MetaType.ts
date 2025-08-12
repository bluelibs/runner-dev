import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";

export const MetaTagUsageType: GraphQLObjectType = new GraphQLObjectType({
  name: "MetaTagUsage",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    config: { type: GraphQLString },
  }),
});

export const MetaType: GraphQLObjectType = new GraphQLObjectType({
  name: "Meta",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    title: { description: "Human-readable title", type: GraphQLString },
    description: { description: "Longer description", type: GraphQLString },
    tags: {
      description:
        "Tags attached to the element with optional serialized config",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MetaTagUsageType))
      ),
      resolve: (node: {
        tagsDetailed?: Array<{ id: string; config?: string | null }>;
        tags?: string[];
      }) => {
        if (Array.isArray(node?.tagsDetailed)) return node.tagsDetailed;
        if (Array.isArray(node?.tags)) {
          return node.tags.map((id) => ({ id, config: null }));
        }
        return [];
      },
    },
  }),
});
