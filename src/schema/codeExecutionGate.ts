/**
 * Single gate for server-side code execution (`eval`, `shell`,
 * `shellComplete`, and the `shellEnabled` probe).
 *
 * Sensible default: allowed everywhere except production. Production can
 * still opt in explicitly with `RUNNER_DEV_EVAL=1` (useful for debugging a
 * live system you own).
 */
export function isCodeExecutionAllowed(): boolean {
  return (
    process.env.RUNNER_DEV_EVAL === "1" || process.env.NODE_ENV !== "production"
  );
}
