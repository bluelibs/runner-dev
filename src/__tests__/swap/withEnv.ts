/** Env overrides for a test; `undefined` means "unset". */
export type EnvOverrides = Record<string, string | undefined>;

function applyEnv(overrides: EnvOverrides): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function snapshotEnv(overrides: EnvOverrides): EnvOverrides {
  const snapshot: EnvOverrides = {};
  for (const key of Object.keys(overrides)) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

/** Runs `run` with env vars set (or unset), then restores previous values. */
export function withEnv(overrides: EnvOverrides, run: () => void): void {
  const previous = snapshotEnv(overrides);
  applyEnv(overrides);
  try {
    run();
  } finally {
    applyEnv(previous);
  }
}

/** Async twin of `withEnv`: restores once the returned promise settles. */
export async function withEnvAsync<T>(
  overrides: EnvOverrides,
  run: () => Promise<T>
): Promise<T> {
  const previous = snapshotEnv(overrides);
  applyEnv(overrides);
  try {
    return await run();
  } finally {
    applyEnv(previous);
  }
}

/** Env where the code-execution gate is closed: nothing opted in. */
export const CODE_EXECUTION_DISABLED_ENV: EnvOverrides = {
  RUNNER_DEV_EVAL: undefined,
  NODE_ENV: undefined,
};
