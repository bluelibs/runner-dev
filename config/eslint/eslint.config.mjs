import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FlatCompat is used to load legacy plugins/configs (like prettier) in flat config mode
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const rootDir = path.resolve(__dirname, "../../");

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("plugin:prettier/recommended"),
  {
    // Main source files
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/__tests__/**"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: "config/ts/tsconfig.json",
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  {
    // Test files
    files: ["src/__tests__/**/*.ts"],
    plugins: {
      jest: (await import("eslint-plugin-jest")).default,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // Tests usually don't need type-aware rules if they aren't in the main tsconfig
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
