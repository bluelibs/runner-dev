import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function formatSummaryLine(label, passed, failed, pending, total) {
  const parts = [];

  if (passed > 0) parts.push(`${passed} passed`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (pending > 0) parts.push(`${pending} skipped`);

  parts.push(`${total} total`);

  return `${label}: ${parts.join(", ")}`;
}

function printFailureDetails(testResults) {
  const failedSuites = testResults.filter((result) => result.failureMessage);

  if (failedSuites.length === 0) return;

  console.error("");

  for (const suite of failedSuites) {
    console.error(suite.testFilePath);
    console.error(suite.failureMessage.trim());
    console.error("");
  }
}

async function main() {
  const jestPackageJson = require.resolve("jest/package.json");
  const jestBin = path.join(path.dirname(jestPackageJson), "bin", "jest.js");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "runner-dev-jest-"));
  const outputFile = path.join(tempDir, "results.json");
  const forwardedArgs = process.argv.slice(2);

  const child = spawn(
    process.execPath,
    [
      jestBin,
      "--config",
      "config/jest/jest.config.js",
      "--runInBand",
      "--silent",
      "--json",
      "--outputFile",
      outputFile,
      ...forwardedArgs,
    ],
    {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    }
  );

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  try {
    const raw = await readFile(outputFile, "utf8");
    const results = JSON.parse(raw);
    const elapsedSeconds = ((Date.now() - results.startTime) / 1000).toFixed(3);

    console.log(
      formatSummaryLine(
        "Test Suites",
        results.numPassedTestSuites,
        results.numFailedTestSuites + results.numRuntimeErrorTestSuites,
        results.numPendingTestSuites,
        results.numTotalTestSuites
      )
    );
    console.log(
      formatSummaryLine(
        "Tests",
        results.numPassedTests,
        results.numFailedTests,
        results.numPendingTests + results.numTodoTests,
        results.numTotalTests
      )
    );
    console.log(`Snapshots: ${results.snapshot.total} total`);
    console.log(`Time: ${elapsedSeconds} s`);
    console.log(`Ran ${results.numTotalTestSuites} test suites.`);

    if (!results.success) {
      printFailureDetails(results.testResults);

      if (stderr.trim()) {
        console.error(stderr.trim());
      } else if (stdout.trim()) {
        console.error(stdout.trim());
      }
    }
  } catch (error) {
    if (stderr.trim()) {
      console.error(stderr.trim());
    }

    if (stdout.trim()) {
      console.error(stdout.trim());
    }

    console.error("[test:qa] Failed to read Jest JSON summary.");
    console.error(error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  process.exit(exitCode ?? 1);
}

main().catch((error) => {
  console.error("[test:qa] Unexpected error while running Jest.");
  console.error(error);
  process.exit(1);
});
