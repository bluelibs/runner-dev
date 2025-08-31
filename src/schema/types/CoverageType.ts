import {
  GraphQLInt,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
} from "graphql";
import type { CustomGraphQLContext } from "../context";

type CoverageNode = { filePath?: string | null };

export const CoverageInfoType: GraphQLObjectType<
  CoverageNode,
  CustomGraphQLContext
> = new GraphQLObjectType<CoverageNode, CustomGraphQLContext>({
  name: "CoverageInfo",
  description:
    "Test coverage information for a specific element file. Details are computed on demand.",
  fields: (): GraphQLFieldConfigMap<CoverageNode, CustomGraphQLContext> => ({
    percentage: {
      description: "Statement coverage percentage (0-100, rounded).",
      type: GraphQLInt,
      resolve: async (node, _args, ctx) => {
        const fp = node?.filePath ?? null;
        const summary = await ctx.coverage?.getSummaryForPath(fp);
        return summary?.percentage ?? 0;
      },
    },
    totalStatements: {
      description: "Total statements counted for this file (if known).",
      type: GraphQLInt,
      resolve: async (node, _args, ctx) => {
        const fp = node?.filePath ?? null;
        const summary = await ctx.coverage?.getSummaryForPath(fp);
        return summary?.totalStatements ?? 0;
      },
    },
    coveredStatements: {
      description: "Number of statements covered for this file (if known).",
      type: GraphQLInt,
      resolve: async (node, _args, ctx) => {
        const fp = node?.filePath ?? null;
        const summary = await ctx.coverage?.getSummaryForPath(fp);
        return summary?.coveredStatements ?? 0;
      },
    },
    details: {
      description:
        "Raw coverage details serialized as JSON string (for this file only).",
      type: GraphQLString,
      resolve: async (node, _args, ctx) => {
        const fp = node?.filePath ?? null;
        const d = await ctx.coverage?.getDetailsForPath(fp);
        if (d == null) return null;
        try {
          return JSON.stringify(d, null, 2);
        } catch {
          return String(d);
        }
      },
    },
  }),
});
