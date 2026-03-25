export function packageJson(projectName: string) {
  return {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "commonjs",
    scripts: {
      dev: "tsx watch src/main.ts",
      start: "node --enable-source-maps dist/main.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run",
      "test:watch": "vitest",
      qa: "npm run build && npm run test",
      "schema:sdl": "runner-dev schema sdl",
      "skills:extract": "npm-skills extract --skip-production --override",
      postinstall: "npm run skills:extract",
    },
    dependencies: {
      "@bluelibs/runner": "^6.4.0",
      "npm-skills": "^0.5.0",
    },
    devDependencies: {
      "@bluelibs/runner-dev": "^6.4.0",
      "@types/node": "^20.0.0",
      typescript: "^5.6.3",
      tsx: "^4.20.5",
      vitest: "^3.2.4",
    },
  } as const;
}
