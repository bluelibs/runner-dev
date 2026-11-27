import type { Live } from "./types";

const lastCaptureFailure = new WeakMap<Live, string>();

/** Instrumentation runs inside the application's call stack. Its failures belong to DevTools. */
export function observeHistory(live: Live, capture: () => void): void {
  try {
    capture();
  } catch (error) {
    lastCaptureFailure.set(
      live,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function historyRecordingError(live: Live): string | null {
  return live.persistenceError ?? lastCaptureFailure.get(live) ?? null;
}
