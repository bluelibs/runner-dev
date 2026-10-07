import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";

// Separate builds keep the standalone docs export self-contained and isolate Studio styles.
export default defineConfig({
  plugins: [react()],
  base: "/durable/",
  build: {
    outDir: "../../dist/ui/durable",
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    rollupOptions: { input: path.resolve(__dirname, "src/durable/main.tsx") },
  },
});
