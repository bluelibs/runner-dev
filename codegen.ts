import type { CodegenConfig } from "@graphql-codegen/cli";
import * as path from "path";

const config: CodegenConfig = {
  // Load schema from code-first module (TypeScript)
  schema: path.join(__dirname, "src/schema/index.ts"),
  generates: {
    [path.join(__dirname, "src/generated/resolvers-types.ts")]: {
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
  // Ensure TS schema module is loaded
  require: ["ts-node/register/transpile-only"],
};

export default config;
