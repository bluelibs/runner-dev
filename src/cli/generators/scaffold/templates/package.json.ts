const VITEST_RANGE = "^5.0.1";

export function packageJson(projectName: string) {
  return {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "commonjs",
    engines: { node: "^22.12.0 || >=24.0.0" },
    scripts: {
      dev: "tsx watch src/main.ts",
      start: "node --enable-source-maps dist/main.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run",
      "test:watch": "vitest",
      qa: "npm run build && npm run test",
      audit: "npm audit",
      "schema:sdl": "runner-dev schema sdl",
      "skills:extract": "npm-skills extract --skip-production --override",
      postinstall: "npm run skills:extract",
    },
    dependencies: {
      "@bluelibs/runner": "^6.6.0",
      "npm-skills": "^0.5.0",
    },
    devDependencies: {
      "@bluelibs/runner-dev": "^6.6.0",
      // vitest 5 requires @types/node 22+, which also matches `engines`.
      "@types/node": "^22.12.0",
      typescript: "^5.6.3",
      tsx: "^4.23.13",
      vitest: VITEST_RANGE,
    },
    // vite 8.3 has an optional peer chain (@vitejs/devtools -> devtools-vitest
    // -> vitest@*) that npm 10/11 resolve to mismatched vitest plugin versions
    // and then crash on ("Cannot read properties of null (reading 'edgesOut')").
    // Pinning every vitest edge to the project's own range keeps the peer set
    // consistent. It must equal the devDependency spec, or npm reports EOVERRIDE.
    overrides: {
      vitest: VITEST_RANGE,
    },
  } as const;
}
