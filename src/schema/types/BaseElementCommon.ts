import {
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import { readFile, type ReadFileOptions } from "../utils";
import { sanitizePath } from "../../utils/path";
import type { BaseElement } from "../model";
import type { Introspector } from "../../resources/introspector.resource";
import { TagType } from "./TagType";

/**
 * Shared fields that we want available on all concrete element types.
 * - fileContents(startLine?, endLine?)
 * - markdownDescription
 */
export function baseElementCommonFields(): GraphQLFieldConfigMap<
  BaseElement,
  { introspector: Introspector }
> {
  return {
    fileContents: {
      description:
        "Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine. Caution: avoid querying this in bulk; prefer fetching one file at a time.",
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
      resolve: async (node: BaseElement, args: ReadFileOptions) => {
        if (!node?.filePath) return null;
        // Note: we keep reading from the real path, only redacting what we expose elsewhere
        return await readFile(node.filePath, args);
      },
    },
    markdownDescription: {
      description:
        "Markdown composed from meta.title and meta.description (if present)",
      type: new GraphQLNonNull(GraphQLString),
      resolve: (node: BaseElement) => {
        const title = node.meta?.title ?? node.id;
        const description = node.meta?.description ?? "N/A";
        const titlePart = `# ${title}\n`;
        const descPart = `\n${description}`;
        const result = `${titlePart}${descPart}`.trim();
        return result;
      },
    },
    tags: {
      description: "Tags associated with this element.",
      type: new GraphQLList(new GraphQLNonNull(TagType)),
      resolve: (node: BaseElement, _, { introspector }) => {
        const tagIds = node.meta?.tags ?? [];
        if (!tagIds.length) {
          return [];
        }
        return tagIds
          .map((id) => introspector.getTag(id))
          .filter((t): t is NonNullable<typeof t> => t !== null);
      },
    },
  };
}
