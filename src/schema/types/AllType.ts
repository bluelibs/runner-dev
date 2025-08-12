import {
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import { readFile } from "../../graphql/utils";
import { All } from "../model";
import { MetaType } from "./MetaType";
import type { AllFileContentsArgs } from "../../generated/resolvers-types";

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
      if (Array.isArray(value?.registers) && Array.isArray(value?.overrides)) {
        return "Resource";
      }
      if (
        Array.isArray(value?.usedByTasks) &&
        Array.isArray(value?.usedByResources)
      ) {
        return "Middleware";
      }
      if (Array.isArray(value?.listenedToBy)) {
        return "Event";
      }
      if (typeof value?.event === "string") {
        return "Listener";
      }
      if (Array.isArray(value?.emits) && Array.isArray(value?.dependsOn)) {
        return "Task";
      }
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
      description:
        "Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine.",
      type: GraphQLString,
      args: {
        startLine: {
          description: "1-based inclusive start line",
          type: GraphQLInt,
        },
        endLine: {
          description: "1-based inclusive end line",
          type: GraphQLInt,
        },
      },
      resolve: async (
        node: { filePath?: string | null },
        args: AllFileContentsArgs
      ) => {
        if (!node?.filePath) return null;
        return await readFile(node.filePath, args);
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
