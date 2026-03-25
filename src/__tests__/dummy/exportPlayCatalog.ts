import path from "node:path";
import { exportDocs } from "../../index";
import { createEnhancedSuperApp } from "./enhanced";

async function main() {
  const requestedOutput = process.argv[2] || "./runner-dev-catalog";
  const outputDir = path.resolve(process.cwd(), requestedOutput);
  const app = createEnhancedSuperApp();
  const result = await exportDocs(app, {
    output: outputDir,
    overwrite: true,
  });
  const relativeEntryPath = path.relative(process.cwd(), result.entryHtmlPath);

  console.log(`[runner-dev.play:export] ✅ Exported to ${relativeEntryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
