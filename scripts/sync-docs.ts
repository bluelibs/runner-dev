import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  bold,
  createSpinner,
  cyan,
  dim,
  gray,
  green,
  magenta,
  pad,
  red,
  yellow,
} from "./tools/color-utils";

type FileCopyTarget = {
  src: string;
  dest: string;
};

type CopyResult = {
  file: FileCopyTarget;
  ok: boolean;
  durationMs: number;
  errorMessage?: string;
};

const MIN_SPINNER_VISIBILITY_MS = 420;

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function printBanner(totalFiles: number) {
  const title = `${cyan("RUNNER")} ${magenta("DOCS")} ${bold("SYNC")}`;
  const accent = cyan("=".repeat(52));

  console.log("");
  console.log(accent);
  console.log(`  ${title}`);
  console.log(
    `  ${dim("Syncing docs from ../runner/readmes into ./readmes")}`
  );
  console.log(`  ${gray(`Files queued: ${totalFiles}`)}`);
  console.log(accent);
  console.log("");
}

function printSection(label: string) {
  console.log(`${bold(cyan(">>"))} ${bold(label)}`);
}

async function copyDoc(file: FileCopyTarget): Promise<CopyResult> {
  const startedAt = Date.now();
  const label = path.basename(file.dest);
  const spinner = createSpinner(label, { idleText: "copying..." });

  spinner.start();

  try {
    await Promise.all([fs.copyFile(file.src, file.dest), sleep(MIN_SPINNER_VISIBILITY_MS)]);
    const durationMs = Date.now() - startedAt;

    spinner.stop(
      `${green("[OK]")} ${bold(label)} ${gray(file.src)} ${dim("->")} ${gray(
        file.dest
      )}`
    );

    return {
      file,
      ok: true,
      durationMs,
    };
  } catch (err: unknown) {
    const elapsedMs = Date.now() - startedAt;
    const remainingDelayMs = MIN_SPINNER_VISIBILITY_MS - elapsedMs;

    if (remainingDelayMs > 0) {
      await sleep(remainingDelayMs);
    }

    const durationMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);

    spinner.stop(
      `${red("[FAIL]")} ${bold(label)} ${gray(file.src)} ${dim("->")} ${gray(
        file.dest
      )}\n       ${dim(
        errorMessage
      )}`
    );

    return {
      file,
      ok: false,
      durationMs,
      errorMessage,
    };
  }
}

function printSummary(results: CopyResult[]) {
  const copied = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  console.log("");
  printSection("Summary");
  console.log(
    `${green(pad("  Copied", 10))} ${bold(String(copied.length))} ${dim(
      "files landed cleanly"
    )}`
  );
  console.log(
    `${failed.length ? red(pad("  Failed", 10)) : gray(pad("  Failed", 10))} ${bold(
      String(failed.length)
    )} ${dim("files need attention")}`
  );

  if (failed.length > 0) {
    console.log("");
    printSection("Failures");
    for (const result of failed) {
      console.log(
        `${red("  -")} ${bold(path.basename(result.file.dest))}: ${dim(
          result.errorMessage ?? "Unknown error"
        )}`
      );
    }
  }

  console.log("");
}

async function copyDocs() {
  const filesToCopy: FileCopyTarget[] = [
    {
      src: path.join("..", "runner", "readmes", "AI.md"),
      dest: path.join("readmes", "runner-AI.md"),
    },
    {
      src: path.join("..", "runner", "readmes", "REMOTE_LANES.md"),
      dest: path.join("readmes", "runner-remote-lanes.md"),
    },
    {
      src: path.join("..", "runner", "readmes", "DURABLE_WORKFLOWS.md"),
      dest: path.join("readmes", "runner-durable-workflows.md"),
    },
    {
      src: path.join("..", "runner", "readmes", "FULL_GUIDE.md"),
      dest: path.join("readmes", "runner-full-guide.md"),
    },
  ];

  printBanner(filesToCopy.length);
  printSection("Preparing output directory");
  await fs.mkdir("readmes", { recursive: true });
  console.log(`${green("[READY]")} ${gray("./readmes")} ${dim("is ready")}`);
  console.log("");

  printSection("Copying documents");
  const results: CopyResult[] = [];

  for (const file of filesToCopy) {
    results.push(await copyDoc(file));
  }

  printSummary(results);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

copyDocs().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(`${red("[ABORTED]")} ${bold("sync-docs crashed")} ${dim(errorMessage)}`);
  process.exitCode = 1;
});
