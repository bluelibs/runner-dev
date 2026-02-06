const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../runner/readmes/AI.md');
const DESTINATION = path.resolve(__dirname, '../readmes/RUNNER_AI.md');

try {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source file not found: ${SOURCE}`);
    process.exit(1);
  }

  // Ensure destination directory exists
  const destDir = path.dirname(DESTINATION);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(SOURCE, DESTINATION);
  console.log(`Successfully synced ${SOURCE} to ${DESTINATION}`);
} catch (error) {
  console.error('Error syncing RUNNER_AI.md:', error.message);
  process.exit(1);
}
