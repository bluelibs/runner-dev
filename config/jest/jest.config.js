const path = require("path");
const rootDir = path.resolve(__dirname, "../../");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: rootDir,
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  // UI tests live next to their components. Jest never instruments test files,
  // so matching them here only adds them as 0%-covered "source" and skews the
  // global numbers; exclude them explicitly.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/*.test.{ts,tsx}",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html"],
  // A ratchet toward the 100% goal: the last measured global numbers, rounded
  // down. Raise them as coverage improves; never lower them or exclude source
  // files to make a run pass.
  coverageThreshold: {
    global: {
      statements: 57,
      branches: 44,
      functions: 54,
      lines: 58,
    },
  },
  projects: [
    {
      rootDir: rootDir,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      testPathIgnorePatterns: [
        "<rootDir>/src/ui/src/components/Documentation/components/chat/",
      ],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "config/ts/tsconfig.json",
          },
        ],
      },
      moduleNameMapper: {
        "\\.(css|scss)$": "<rootDir>/config/jest/styleMock.js",
      },
    },
    {
      rootDir: rootDir,
      displayName: "jsdom",
      testEnvironment: "jsdom",
      // Every React (.tsx) UI test belongs here: the node project only matches
      // *.test.ts, so a narrower whitelist would silently skip new .tsx suites.
      testMatch: [
        "<rootDir>/src/ui/src/components/Documentation/components/chat/**/*.test.ts",
        "<rootDir>/src/ui/**/*.test.tsx",
      ],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "config/ts/tsconfig.json",
          },
        ],
      },
      moduleNameMapper: {
        "\\.(css|scss)$": "<rootDir>/config/jest/styleMock.js",
      },
      setupFilesAfterEnv: [path.join(rootDir, "config/jest/jest.setup.js")],
    },
  ],
};
