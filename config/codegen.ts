import type { CodegenConfig } from "@graphql-codegen/cli";
import { lexicographicSortSchema } from "graphql";
import * as path from "path";
import { schema } from "../src/schema";

const config: CodegenConfig = {
  // Preserve internal enum values and avoid native TS imports bypassing CommonJS resolution.
  schema: lexicographicSortSchema(schema),
  generates: {
    [path.join(__dirname, "../src/generated/resolvers-types.ts")]: {
      plugins: ["typescript", "typescript-resolvers"],
      config: {
        useIndexSignature: true,
        contextType: "../schema/context#CustomGraphQLContext",
        avoidOptionals: true,
        maybeValue: "T | null | undefined",
        enumsAsTypes: true,
        scalars: {
          Float: "number",
          ID: "string",
        },
      },
    },
  },
};

export default config;
