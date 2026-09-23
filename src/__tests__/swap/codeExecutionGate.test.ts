import {
  CODE_EXECUTION_ENABLE_HINT,
  codeExecutionDisabledMessage,
  isCodeExecutionAllowed,
} from "../../schema/codeExecutionGate";
import { withEnv } from "./withEnv";

describe("isCodeExecutionAllowed", () => {
  test.each([
    ["development", true],
    ["test", true],
    [undefined, false],
    ["production", false],
    ["staging", false],
    ["prod", false],
    ["Development", false],
    ["", false],
  ])("NODE_ENV=%p without RUNNER_DEV_EVAL -> %p", (nodeEnv, expected) => {
    withEnv({ NODE_ENV: nodeEnv, RUNNER_DEV_EVAL: undefined }, () => {
      expect(isCodeExecutionAllowed()).toBe(expected);
    });
  });

  test("RUNNER_DEV_EVAL=1 opts in on any NODE_ENV, including unset", () => {
    withEnv({ NODE_ENV: "production", RUNNER_DEV_EVAL: "1" }, () => {
      expect(isCodeExecutionAllowed()).toBe(true);
    });
    withEnv({ NODE_ENV: undefined, RUNNER_DEV_EVAL: "1" }, () => {
      expect(isCodeExecutionAllowed()).toBe(true);
    });
  });

  test("only the exact value 1 counts as an opt-in", () => {
    withEnv({ NODE_ENV: undefined, RUNNER_DEV_EVAL: "true" }, () => {
      expect(isCodeExecutionAllowed()).toBe(false);
    });
  });
});

describe("codeExecutionDisabledMessage", () => {
  test("names the feature and explains how to enable it", () => {
    const message = codeExecutionDisabledMessage("Shell");
    expect(message).toBe(
      `Shell is disabled in this environment. ${CODE_EXECUTION_ENABLE_HINT}`
    );
    expect(message).toContain("RUNNER_DEV_EVAL=1");
    expect(message).toContain("NODE_ENV=development");
  });
});
