import {
  GraphQLBoolean,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import { readFile, type ReadFileOptions } from "../utils";
import { sanitizePath, resolvePathInput } from "../../utils/path";
import type { BaseElement } from "../model";
import { TagType, TagUsageType } from "./TagType";
import { MetaType } from "./MetaType";
import { CoverageInfoType } from "./CoverageType";
import { CustomGraphQLContext } from "../context";

/**
 * Shared fields that we want available on all concrete element types.
 * - fileContents(startLine?, endLine?)
 * - markdownDescription
 */
export function baseElementCommonFields(): GraphQLFieldConfigMap<
  BaseElement,
  CustomGraphQLContext
> {
  return {
    id: {
      description: "Unique identifier for the element",
      type: new GraphQLNonNull(GraphQLID),
    },
    meta: {
      description: "Metadata for the element",
      type: MetaType,
    },
    filePath: {
      description: "Path to task file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    isPrivate: {
      description:
        "True when this element is private to a resource boundary defined by isolate().",
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: (node: BaseElement) => node.isPrivate === true,
    },
    visibilityReason: {
      description:
        "Optional visibility explanation (useful for debugging isolate() boundaries).",
      type: GraphQLString,
      resolve: (node: BaseElement) => node.visibilityReason ?? null,
    },
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
        const abs = resolvePathInput(node.filePath) ?? node.filePath;
        return await readFile(abs, args);
      },
    },
    coverage: {
      description:
        "Coverage summary for this element's file (percentage is always resolvable if coverage report is present).",
      type: CoverageInfoType,
      resolve: (node: BaseElement) => ({ filePath: node.filePath || null }),
    },
    coverageContents: {
      description:
        "Raw coverage report contents from the project (entire file), or null if not available.",
      type: GraphQLString,
      resolve: async (
        _node: BaseElement,
        _args: any,
        ctx: CustomGraphQLContext
      ) => {
        const raw = await ctx.coverage?.getRawCoverageContents();
        return raw ?? null;
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
        const tagIds = node.tags ?? [];
        if (!tagIds.length) {
          return [];
        }
        return tagIds
          .map((id) => introspector.getTag(id))
          .filter((t): t is NonNullable<typeof t> => t !== null);
      },
    },
    tagsDetailed: {
      description: "Detailed tags associated with this element",
      type: new GraphQLList(new GraphQLNonNull(TagUsageType)),
      resolve: (node: BaseElement, _, { introspector }) => {
        const tagIds = node.tags ?? [];
        if (!tagIds.length) {
          return [];
        }
        return tagIds
          .map((id) => introspector.getTag(id))
          .filter((t): t is NonNullable<typeof t> => t !== null)
          .map((t) => ({
            id: t.id,
            configSchema: t.configSchema,
          }));
      },
    },
  };
}
