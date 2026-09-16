export function packageJson(projectName: string) {
  return {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "commonjs",
    engines: { node: "^20.19.0 || ^22.12.0 || >=24.0.0" },
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
      "@types/node": "^20.0.0",
      typescript: "^5.6.3",
      tsx: "^4.23.13",
      vitest: "^4.1.11",
    },
  } as const;
}
