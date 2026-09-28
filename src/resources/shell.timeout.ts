export const SHELL_TIMEOUT_ENV_VAR = "RUNNER_DEV_SHELL_TIMEOUT_MS";
export const DEFAULT_SHELL_TIMEOUT_MS = 30_000;

/** Largest delay `setTimeout` honors; bigger values fire immediately. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Reads the timeout for server-side code runs (`shell` and `eval`) from
 * `RUNNER_DEV_SHELL_TIMEOUT_MS` (unset or blank means the 30s default).
 * Malformed values throw instead of silently falling back, so a typo never
 * quietly changes how long snippets may run.
 */
export function resolveShellTimeoutMs(
  rawValue: string | undefined = process.env[SHELL_TIMEOUT_ENV_VAR]
): number {
  const trimmed = rawValue?.trim() ?? "";
  if (trimmed === "") return DEFAULT_SHELL_TIMEOUT_MS;

  const parsed = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || parsed < 1 || parsed > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `Invalid ${SHELL_TIMEOUT_ENV_VAR}="${rawValue}": expected a whole number of milliseconds between 1 and ${MAX_TIMER_DELAY_MS}.`
    );
  }
  return parsed;
}

/** `feature` names the operation that timed out, e.g. "Shell" or "Eval". */
export function executionTimeoutMessage(
  feature: string,
  timeoutMs: number
): string {
  return (
    `${feature} execution timed out after ${timeoutMs} ms. ` +
    `The code may still be running on the server: JavaScript cannot cancel it. ` +
    `Set ${SHELL_TIMEOUT_ENV_VAR} to allow longer runs.`
  );
}

export type ShellTimeoutOutcome<T> =
  | { timedOut: false; value: T }
  | { timedOut: true };

/**
 * One deadline for a whole code run, so `shell` and `eval` always answer.
 *
 * A run can await more than one step: the shell first binds `r`, which may
 * run a lazy resource's init, and then runs the snippet. Racing every step
 * against the same deadline keeps the total wait within the budget instead of
 * granting each step a fresh one.
 *
 * This only bounds how long the caller waits: the awaited work keeps running
 * after the deadline. A synchronous infinite loop (`while (true) {}`) blocks
 * the event loop before this timer can ever fire, so it cannot be interrupted
 * at all; that needs a worker/isolate, which would lose access to the live
 * runtime the shell exists to expose.
 */
export interface ShellDeadline {
  readonly timeoutMs: number;
  race<T>(step: Promise<T>): Promise<ShellTimeoutOutcome<T>>;
  /** Stops the timer once the run has answered. */
  clear(): void;
}

export function startShellDeadline(timeoutMs: number): ShellDeadline {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    // A pending deadline must not keep the process alive on shutdown.
    timer.unref();
  });
  return {
    timeoutMs,
    race: (step) =>
      Promise.race([
        step.then((value) => ({ timedOut: false as const, value })),
        expired,
      ]),
    clear: () => clearTimeout(timer),
  };
}

/** Races a single step against its own deadline (see `ShellDeadline`). */
export async function raceShellTimeout<T>(
  execution: Promise<T>,
  timeoutMs: number
): Promise<ShellTimeoutOutcome<T>> {
  const deadline = startShellDeadline(timeoutMs);
  try {
    return await deadline.race(execution);
  } finally {
    deadline.clear();
  }
}
