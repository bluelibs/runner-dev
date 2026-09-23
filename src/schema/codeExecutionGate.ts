/**
 * Single gate for server-side code execution: `eval`, `shell`,
 * `shellComplete`, `swapTask`, `evalInput` on `invokeTask`/`invokeEvent`,
 * and the `shellEnabled` probe.
 *
 * Fail closed: execution is allowed only when explicitly opted in with
 * `RUNNER_DEV_EVAL=1`, or when `NODE_ENV` is exactly `development` or `test`.
 * An unset `NODE_ENV` is common on deployed boxes (plain `node dist/main.js`,
 * containers, PaaS), so treating "not production" as "safe" would silently
 * expose remote code execution there. Unknown values (`staging`, `prod`,
 * typos) are refused for the same reason.
 */
const CODE_EXECUTION_NODE_ENVS = new Set(["development", "test"]);

export const CODE_EXECUTION_ENABLE_HINT =
  "Set RUNNER_DEV_EVAL=1 or NODE_ENV=development on the server to enable it.";

export function isCodeExecutionAllowed(): boolean {
  if (process.env.RUNNER_DEV_EVAL === "1") return true;
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv !== undefined && CODE_EXECUTION_NODE_ENVS.has(nodeEnv);
}

/** Error text returned by gated operations, always with the way to enable. */
export function codeExecutionDisabledMessage(feature: string): string {
  return `${feature} is disabled in this environment. ${CODE_EXECUTION_ENABLE_HINT}`;
}
