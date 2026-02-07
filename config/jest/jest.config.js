const path = require("path");
const rootDir = path.resolve(__dirname, "../../");

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: rootDir,
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  projects: [
    {
      rootDir: rootDir,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      testPathIgnorePatterns: ["<rootDir>/src/ui/src/components/Documentation/components/chat/"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "config/ts/tsconfig.json",
          },
        ],
      },
    },
    {
      rootDir: rootDir,
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/src/ui/src/components/Documentation/components/chat/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "config/ts/tsconfig.json",
          },
        ],
      },
      setupFilesAfterEnv: [path.join(rootDir, "config/jest/jest.setup.js")],
    },
  ],
};
