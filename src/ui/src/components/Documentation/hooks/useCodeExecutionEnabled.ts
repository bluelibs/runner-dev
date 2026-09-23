import React from "react";
import {
  CODE_EXECUTION_ENABLED_QUERY,
  graphqlRequest,
  type CodeExecutionEnabledResult,
} from "../utils/graphqlClient";

/**
 * Asks the server whether its code-execution gate (eval, shell, swapTask,
 * editFile, ...) is open, so features can say so before the user acts.
 *
 * Tri-state: `null` while unknown or when the probe fails. Callers treat it
 * optimistically, so a slow or failed probe never locks a feature; the
 * operation itself still reports the real error.
 */
export function useCodeExecutionEnabled(active: boolean): boolean | null {
  const [enabled, setEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setEnabled(null);
    void (async () => {
      try {
        const response = await graphqlRequest<CodeExecutionEnabledResult>(
          CODE_EXECUTION_ENABLED_QUERY
        );
        if (!cancelled) setEnabled(response?.codeExecutionEnabled ?? null);
      } catch {
        if (!cancelled) setEnabled(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return enabled;
}
