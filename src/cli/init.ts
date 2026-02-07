import path from "path";
import { ensureEmptyDir, runCommand, parseFlags } from "./generators/initUtils";
import { c, alignRows, divider, indentLines } from "./format";
import type { ArtifactKind } from "./generators/common";
import { scaffoldArtifact } from "./generators/artifact";
import { scaffold } from "./generators/scaffold";
import { printNewHelp } from "./generators/printNewHelp";

type ScaffoldOptions = {
  projectName: string;
  targetDir: string;
};

export async function main(argv: string[]): Promise<void> {
  // argv: [node, runner-dev, new, maybeKindOrName, maybeName, ...flags]
  const maybeKindOrName = argv[3];
  const maybeName = argv[4];
  // Parse flags from the subcommand onward to support both:
  // - runner-dev new project my-app --install
  // - runner-dev new my-app --install (back-compat)
  // We pass the whole tail; parseFlags ignores non --* tokens.
  const flagArgs = argv.slice(3);
  const { flagSet, flagGet } = parseFlags(flagArgs);
  if (
    maybeKindOrName === "help" ||
    maybeKindOrName === "-h" ||
    maybeKindOrName === "--help" ||
    flagSet.has("help") ||
    !maybeKindOrName
  ) {
    printNewHelp();
    return;
  }
  const knownKinds: ArtifactKind[] = [
    "project",
    "resource",
    "task",
    "event",
    "hook",
    "tag",
    "task-middleware",
    "resource-middleware",
  ];

  let kind: ArtifactKind;
  let nameOrProject: string | undefined;
  if (maybeKindOrName === "project") {
    kind = "project";
    nameOrProject = maybeName || "my-runner-project";
  } else if ((knownKinds as string[]).includes(maybeKindOrName)) {
    kind = maybeKindOrName as ArtifactKind;
    nameOrProject = maybeName;
  } else {
    // Backward compat: runner-dev new <projectName>
    kind = "project";
    nameOrProject = maybeKindOrName || "my-runner-project";
  }

  // Shared flags
  const shouldInstall = flagSet.has("install");
  const shouldRun = flagSet.has("run");
  const shouldRunTests = flagSet.has("run-tests") || flagSet.has("runTests");
  // Allow fast/CI mode via env to skip heavy steps even if flags are passed
  const FAST = process.env.RUNNER_DEV_FAST === "1" || process.env.CI === "true";
  const SKIP_INSTALL = FAST || process.env.RUNNER_DEV_SKIP_INSTALL === "1";
  const SKIP_TESTS = FAST || process.env.RUNNER_DEV_SKIP_TESTS === "1";
  const SKIP_RUN = FAST || process.env.RUNNER_DEV_SKIP_RUN === "1";

  if (kind === "project") {
    const projectName = (nameOrProject || "my-runner-project").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
      console.error(
        "Invalid project name. Use only letters, numbers, dashes and underscores."
      );
      process.exitCode = 1;
      return;
    }

    const targetDir = path.resolve(process.cwd(), projectName);
    await ensureEmptyDir(targetDir);

    const options: ScaffoldOptions = { projectName, targetDir };
    await scaffold(options);

    console.log(`\n${c.green("Project created in")} ${c.bold(targetDir)}.`);

    // Helpful options & commands
    const flags = alignRows(
      [
        [c.yellow("--install"), "Install dependencies after scaffold"],
        [c.yellow("--run"), "Run 'npm run dev' after scaffold (keeps running)"],
        [c.yellow("--run-tests"), "Run 'npm test' after scaffold"],
      ],
      { gap: 4, indent: 2 }
    );

    const quick = indentLines(
      [
        `${c.gray("# Query your GraphQL endpoint")}`,
        `ENDPOINT=http://localhost:1337/graphql ${c.cmd(
          "npx runner-dev query"
        )} 'query { tasks { id } }' --format pretty`,
        `${c.gray("# Print SDL")}`,
        `${c.cmd(
          "npx runner-dev schema sdl"
        )} --endpoint http://localhost:1337/graphql`,
      ].join("\n"),
      2
    );

    const headersExample = 'HEADERS=\'{"Authorization":"Bearer ..."}\'';
    const env = alignRows(
      [
        [c.bold("ENDPOINT / GRAPHQL_ENDPOINT"), "GraphQL endpoint URL"],
        [c.bold(headersExample), "Add HTTP headers (JSON)"],
        [c.bold("ALLOW_MUTATIONS=true"), "Enable mutations tool"],
      ],
      { gap: 4, indent: 2 }
    );

    console.log(
      [
        "",
        c.title("Helpful options & commands"),
        divider(),
        c.bold("Flags for 'runner-dev new'"),
        flags,
        "",
        c.bold("Quick commands"),
        quick,
        "",
        c.bold("Environment"),
        env,
        "",
      ].join("\n")
    );

    console.log(
      [
        c.bold("Endpoints"),
        alignRows(
          [
            [c.cyan("GraphQL"), "http://localhost:1337/graphql"],
            [c.cyan("Voyager"), "http://localhost:1337/voyager"],
            [c.cyan("Docs"), "http://localhost:1337/docs"],
          ],
          { gap: 4, indent: 2 }
        ),
      ].join("\n")
    );

    // Execute optional post-scaffold actions
    if ((shouldInstall || shouldRunTests || shouldRun) && !SKIP_INSTALL) {
      console.log("\nInstalling dependencies...\n");
      await runCommand(
        "npm",
        [
          "install",
          "--prefer-offline",
          "--no-audit",
          "--no-fund",
          "--progress=false",
        ],
        targetDir
      );
    } else if (shouldInstall && SKIP_INSTALL) {
      console.log("\nSkipping install due to RUNNER_DEV_* env.\n");
    }
    if (shouldRunTests && !SKIP_TESTS) {
      console.log("\nRunning tests...\n");
      // Force non-interactive Jest inside the generated project to avoid watch mode hangs
      await runCommand(
        "npm",
        ["run", "test", "--", "--ci", "--watchAll=false", "--runInBand"],
        targetDir
      );
    } else if (shouldRunTests && SKIP_TESTS) {
      console.log("\nSkipping tests due to RUNNER_DEV_* env.\n");
    }
    if (shouldRun && !SKIP_RUN) {
      console.log("\nStarting dev server... (Ctrl+C to stop)\n");
      await runCommand("npm", ["run", "dev"], targetDir);
    } else if (shouldRun && SKIP_RUN) {
      console.log("\nSkipping dev server start due to RUNNER_DEV_* env.\n");
    }

    console.log(
      `\n${c.bold("Next steps")}\n${alignRows(
        [
          [c.cmd(`cd ${projectName}`), "enter project directory"],
          [c.cmd("npm install"), "install dependencies"],
          [c.cmd("npm run dev"), "start local dev server"],
        ],
        { gap: 4, indent: 2 }
      )}`
    );
    return;
  }

  // Artifact scaffolding in existing project
  const nameRaw = (nameOrProject || "").trim();
  if (!nameRaw) {
    console.error(
      `Please provide a name. Usage: runner-dev new ${kind} <name> [--ns app] [--dir src] [--dry]`
    );
    process.exitCode = 1;
    return;
  }

  const nsArg = flagGet("ns") || flagGet("namespace") || "app";
  const baseDir = flagGet("dir") || "src";
  const dryRun = flagSet.has("dry") || flagSet.has("dry-run");
  const addIndex = flagSet.has("export") || flagSet.has("add-export");
  const explicitId = flagGet("id");
  const force = flagSet.has("force");

  let res: Awaited<ReturnType<typeof scaffoldArtifact>>;
  try {
    res = await scaffoldArtifact({
      kind,
      name: nameRaw,
      namespace: nsArg,
      baseDir,
      dryRun,
      addIndex,
      explicitId,
      force,
    });
  } catch (e) {
    console.error((e as Error)?.message || String(e));
    process.exitCode = 1;
    return;
  }

  if (dryRun && res.content) {
    console.log(`\n${c.title("Dry run (no files written)")}`);

    console.log(["Path:", res.filePath, "\n\n", res.content].join("\n"));
    return;
  }

  console.log(
    `\n${c.green("Created")} ${c.bold(
      path.relative(process.cwd(), res.filePath)
    )}\n` +
      alignRows(
        [
          [c.cyan("id"), res.id],
          [
            c.cyan("export"),
            res.exported ? "added to index.ts" : "skip (use --export)",
          ],
        ],
        { gap: 3, indent: 2 }
      )
  );
}
