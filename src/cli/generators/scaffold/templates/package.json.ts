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
      test: "jest",
      "test:watch": "jest --watch",
      "schema:sdl": "runner-dev schema sdl",
    },
    dependencies: {
      "@bluelibs/runner": "^6.0.0",
    },
    devDependencies: {
      "@bluelibs/runner-dev": "^6.0.0",
      typescript: "^5.6.3",
      tsx: "^4.19.2",
      jest: "^29.7.0",
      "ts-jest": "^29.1.1",
      "@types/jest": "^29.5.12",
    },
  } as const;
}
