import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { c, alignRows, divider, indentLines } from "./format";

type ScaffoldOptions = {
  projectName: string;
  targetDir: string;
};

export async function main(argv: string[]): Promise<void> {
  const [, , , rawName] = argv;
  const flagArgs = argv.slice(4);
  const flagSet = new Set(
    flagArgs.filter((a) => a && a.startsWith("--")).map((a) => a.slice(2))
  );
  const shouldInstall = flagSet.has("install");
  const shouldRun = flagSet.has("run");
  const shouldRunTests = flagSet.has("run-tests") || flagSet.has("runTests");
  const projectName = (rawName || "my-runner-project").trim();
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
  if (shouldInstall || shouldRunTests || shouldRun) {
    console.log("\nInstalling dependencies...\n");
    await runCommand(
      "npm",
      ["install", "--prefer-offline", "--no-audit", "--no-fund"],
      targetDir
    );
  }
  if (shouldRunTests) {
    console.log("\nRunning tests...\n");
    await runCommand("npm", ["run", "test", "--", "--runInBand"], targetDir);
  }
  if (shouldRun) {
    console.log("\nStarting dev server... (Ctrl+C to stop)\n");
    await runCommand("npm", ["run", "dev"], targetDir);
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
      start: "node dist/main.js",
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
      "source-map-support": "^0.5.21",
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

  const mainTs = `import 'source-map-support/register';
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
