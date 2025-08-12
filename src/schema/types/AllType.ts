import {
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import { promises as fs } from "fs";
import { All } from "../model";

export const MetaType: GraphQLObjectType = new GraphQLObjectType({
  name: "Meta",
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    title: { description: "Human-readable title", type: GraphQLString },
    description: { description: "Longer description", type: GraphQLString },
    tags: {
      description: "List of tags attached to the element",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
      resolve: (node: { tags?: string[] }) => node?.tags ?? [],
    },
  }),
});

export const BaseElementInterface: GraphQLInterfaceType =
  new GraphQLInterfaceType({
    name: "BaseElement",
    description: "Common fields for all runner elements",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: {
        description: "Stable identifier",
        type: new GraphQLNonNull(GraphQLID),
      },
      meta: {
        description: "Optional metadata (title, description, tags)",
        type: MetaType,
      },
      filePath: {
        description: "Source file path when available",
        type: GraphQLString,
      },
    }),
    resolveType: (value: any) => {
      if (value?.kind === "LISTENER") return "Listener";
      if (value?.kind === "TASK") return "Task";
      if (Array.isArray(value?.registers) && Array.isArray(value?.overrides))
        return "Resource";
      if (
        Array.isArray(value?.usedByTasks) &&
        Array.isArray(value?.usedByResources)
      )
        return "Middleware";
      if (Array.isArray(value?.listenedToBy)) return "Event";
      return "All";
    },
  });

export const AllType: GraphQLObjectType = new GraphQLObjectType({
  name: "All",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) =>
    typeof (value as any)?.id === "string" && !("kind" in (value as any)),
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: {
      description: "Application root id",
      type: new GraphQLNonNull(GraphQLID),
    },
    meta: { description: "Application root metadata", type: MetaType },
    filePath: {
      description: "Path to root resource file",
      type: GraphQLString,
    },
    fileContents: {
      description: "Contents of the file at filePath (if accessible)",
      type: GraphQLString,
      resolve: async (node: { filePath?: string | null }) => {
        if (!node?.filePath) return null;
        try {
          return await fs.readFile(node.filePath, "utf8");
        } catch {
          return null;
        }
      },
    },
    markdownDescription: {
      description:
        "Markdown composed from meta.title and meta.description (if present)",
      type: new GraphQLNonNull(GraphQLString),
      resolve: (node: All) => {
        const title = node.meta?.title ?? node.id;
        const description = node.meta?.description ?? "N/A";
        const titlePart = `# ${title}\n`;
        const descPart = `\n${description}`;
        const result = `${titlePart}${descPart}`.trim();
        return result;
      },
    },
  }),
});
