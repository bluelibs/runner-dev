import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    // Runner-dev UI is intentionally a single large bundle; avoid noisy warnings.
    chunkSizeWarningLimit: 2000,
    outDir: "../../dist/ui",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        docs: path.resolve(__dirname, "src/hydrate-docs.tsx"),
      },
    },
    sourcemap: true,
  },
});
