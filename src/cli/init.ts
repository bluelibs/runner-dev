import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { c, alignRows, divider, indentLines } from "./format";
import type { ArtifactKind } from "./generators/common";
import { scaffoldArtifact } from "./generators/artifact";

type ScaffoldOptions = {
  projectName: string;
  targetDir: string;
};

export async function main(argv: string[]): Promise<void> {
  // argv: [node, runner-dev, new, maybeKindOrName, maybeName, ...flags]
  const maybeKindOrName = argv[3];
  const maybeName = argv[4];
  const flagArgs = argv.slice(5);
  const { flagSet, flagGet } = parseFlags(flagArgs);
  if (
    maybeKindOrName === "help" ||
    maybeKindOrName === "-h" ||
    maybeKindOrName === "--help" ||
    flagSet.has("help")
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
  if (!maybeKindOrName || maybeKindOrName === "project") {
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
      // eslint-disable-next-line no-console
      console.error(
        "Invalid project name. Use only letters, numbers, dashes and underscores."
      );
      process.exit(1);
    }

    const targetDir = path.resolve(process.cwd(), projectName);
    await ensureEmptyDir(targetDir);

    const options: ScaffoldOptions = { projectName, targetDir };
    await scaffold(options);

    // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error(
      `Please provide a name. Usage: runner-dev new ${kind} <name> [--ns app] [--dir src] [--dry]`
    );
    process.exit(1);
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
    // eslint-disable-next-line no-console
    console.error((e as Error)?.message || String(e));
    process.exit(1);
    return; // for type narrowing
  }

  if (dryRun && res.content) {
    // eslint-disable-next-line no-console
    console.log(`\n${c.title("Dry run (no files written)")}`);
    // eslint-disable-next-line no-console
    console.log(["Path:", res.filePath, "\n\n", res.content].join("\n"));
    return;
  }

  // eslint-disable-next-line no-console
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

async function ensureEmptyDir(dir: string): Promise<void> {
  if (fs.existsSync(dir)) {
    const entries = await fsp.readdir(dir);
    if (entries.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Target directory '${path.basename(
          dir
        )}' already exists and is not empty.`
      );
      process.exit(1);
    }
    return;
  }
  await fsp.mkdir(dir, { recursive: true });
}

async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const { targetDir, projectName } = opts;

  const pkg = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/main.ts",
      start: "node --enable-source-maps dist/main.js",
      build: "tsc -p tsconfig.json",
      test: "jest",
      "test:watch": "jest --watch",
      "schema:sdl": "runner-dev schema sdl",
    },
    dependencies: {
      "@bluelibs/runner": "^4.0.0",
    },
    devDependencies: {
      "@bluelibs/runner-dev": "^4.0.0",
      typescript: "^5.6.3",
      tsx: "^4.19.2",
      jest: "^29.7.0",
      "ts-jest": "^29.1.1",
      "@types/jest": "^29.5.12",
    },
  } as const;

  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "Node16",
      moduleResolution: "node16",
      strict: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      outDir: "dist",
      rootDir: "src",
      skipLibCheck: true,
      resolveJsonModule: true,
      lib: ["ESNext"],
    },
    include: ["src"],
  } as const;

  const jestConfig = `/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
};
`;

  const tsconfigJest = {
    extends: "./tsconfig.json",
    compilerOptions: {
      module: "CommonJS",
      moduleResolution: "node",
      target: "ES2019",
      esModuleInterop: true,
      isolatedModules: false,
    },
    include: ["src/**/*.ts", "src/**/*.tsx"],
  } as const;

  const mainTs = `
import { run, resource } from '@bluelibs/runner';
import { dev } from '@bluelibs/runner-dev';

// Minimal Runner app using runner-dev's dev resource
const app = resource({
  id: 'app.${projectName}',
  register: [
    dev.with({ port: 1337 }),
  ],
});

run(app)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Runner app started on http://localhost:1337');
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
`;

  const exampleTest = `describe('smoke', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
`;

  const readme = `# ${projectName}

Generated by \`runner-dev new\`.

## Quick start

1. Install dependencies:
   - npm install
2. Start the dev server:
   - npm run dev

The server starts on http://localhost:1337

- GraphQL endpoint: http://localhost:1337/graphql (how to query your guts and live telemetry)
- Voyager UI: http://localhost:1337/voyager (how the guts of your app look like)
- Project docs: http://localhost:1337/docs (beautiful docs with live telemetry and easy task and event dispatching)

## Scripts

- dev: Run with tsx watch (TypeScript ESM)
- build: Type-check and emit to dist
- start: Run built app
- test: Run Jest

## Useful CLI commands

These commands are available from \`@bluelibs/runner-dev\`:

- Query your API:
  - ENDPOINT=http://localhost:1337/graphql npx runner-dev query 'query { tasks { id } }' --format pretty
- Print the GraphQL schema SDL:
  - npx runner-dev schema sdl --endpoint http://localhost:1337/graphql

`;

  await writeJson(path.join(targetDir, "package.json"), pkg);
  await writeJson(path.join(targetDir, "tsconfig.json"), tsconfig);
  await writeFile(path.join(targetDir, "jest.config.cjs"), jestConfig);
  await writeJson(path.join(targetDir, "tsconfig.jest.json"), tsconfigJest);

  await fsp.mkdir(path.join(targetDir, "src"), { recursive: true });
  await writeFile(path.join(targetDir, "src", "main.ts"), mainTs);
  await writeFile(path.join(targetDir, "src", "main.test.ts"), exampleTest);
  await writeFile(path.join(targetDir, "README.md"), readme);
  await writeGitignore(targetDir);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + "\n";
  await writeFile(filePath, content);
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fsp.writeFile(filePath, content, { encoding: "utf8" });
}

async function writeGitignore(targetDir: string): Promise<void> {
  const content = `node_modules\n.dist\ndist\n.env\n\n`;
  await writeFile(path.join(targetDir, ".gitignore"), content);
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function parseFlags(args: string[]): {
  flagSet: Set<string>;
  flagGet: (name: string) => string | undefined;
} {
  const values = new Map<string, string | undefined>();
  const set = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a || !a.startsWith("--")) continue;
    const keyValue = a.slice(2);
    const eqIdx = keyValue.indexOf("=");
    if (eqIdx !== -1) {
      const k = keyValue.slice(0, eqIdx);
      const v = keyValue.slice(eqIdx + 1);
      set.add(k);
      values.set(k, v);
    } else {
      const k = keyValue;
      set.add(k);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        values.set(k, next);
        i++; // consume value
      } else {
        values.set(k, undefined); // boolean flag
      }
    }
  }
  return {
    flagSet: set,
    flagGet: (name: string) => {
      const v = values.get(name);
      return v === undefined ? undefined : v;
    },
  };
}

function printNewHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      c.title("runner-dev new"),
      divider(),
      alignRows(
        [
          [c.cmd("runner-dev new <name>"), "Scaffold a new project (default)"],
          [c.cmd("runner-dev new project <name>"), "Scaffold project"],
          [c.cmd("runner-dev new resource <name>"), "Scaffold resource"],
          [c.cmd("runner-dev new task <name>"), "Scaffold task"],
          [c.cmd("runner-dev new event <name>"), "Scaffold event"],
          [c.cmd("runner-dev new hook <name>"), "Scaffold hook"],
          [c.cmd("runner-dev new tag <name>"), "Scaffold tag"],
          [
            c.cmd("runner-dev new taskMiddleware <name>"),
            "Scaffold task middleware",
          ],
          [
            c.cmd("runner-dev new resourceMiddleware <name>"),
            "Scaffold resource middleware",
          ],
        ],
        { gap: 3, indent: 2 }
      ),
      "",
      c.bold("Flags"),
      alignRows(
        [
          [
            c.yellow("--ns=<namespace>"),
            "Namespace for id (default: app). Also maps to path as <dir>/<ns>/<type>.",
          ],
          [c.yellow("--id=<id>"), "Explicit id override (ex: app.tasks.save)"],
          [c.yellow("--dir=<dir>"), "Base directory (default: src)"],
          [c.yellow("--export"), "Append export to <dir>/.../index.ts"],
          [c.yellow("--dry"), "Print file to stdout, do not write"],
          [c.yellow("--force"), "Allow overwriting existing files"],
        ],
        { gap: 3, indent: 2 }
      ),
      "",
      c.bold("Examples"),
      indentLines(
        [
          `${c.gray("# Project")}`,
          `${c.cmd("runner-dev new my-app")}`,
          `${c.gray("# Resource")}`,
          `${c.cmd(
            "runner-dev new resource user-service --ns app --dir src --export"
          )}`,
          `${c.gray("# Task")}`,
          `${c.cmd(
            "runner-dev new task create-user --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Event")}`,
          `${c.cmd(
            "runner-dev new event user-registered --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Hook")}`,
          `${c.cmd(
            "runner-dev new hook send-welcome --ns app.users --dir src --export"
          )}`,
          `${c.gray("# Tag")}`,
          `${c.cmd("runner-dev new tag http --ns app.web --dir src --export")}`,
          `${c.gray("# Middleware")}`,
          `${c.cmd(
            "runner-dev new task-middleware auth --ns app --dir src --export"
          )}`,
          `${c.cmd(
            "runner-dev new resource-middleware soft-delete --ns app --dir src --export"
          )}`,
        ].join("\n"),
        2
      ),
      "",
    ].join("\n")
  );
}
