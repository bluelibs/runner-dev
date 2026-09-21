import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import {
  graphqlRequest,
  SHELL_COMPLETE_QUERY,
  type ShellCompleteResult,
} from "./graphqlClient";

/**
 * Creates a CodeMirror completion source backed by the live shell scope.
 *
 * The server resolves identifier-only dotted paths (`runtime`, `r.db`)
 * against the running app without executing anything, so completions reflect
 * real member names, including the current resource value bound to `r`.
 * Empty or failed responses yield `null` so other sources still apply.
 */
export function createShellCompletionSource(
  getResourceId: () => string | null
): CompletionSource {
  return async (
    context: CompletionContext
  ): Promise<CompletionResult | null> => {
    const code = context.state.doc.toString();
    const position = context.pos;
    let response: ShellCompleteResult;
    try {
      response = await graphqlRequest<ShellCompleteResult>(
        SHELL_COMPLETE_QUERY,
        { code, position, resourceId: getResourceId() }
      );
    } catch {
      return null;
    }
    const completion = response.shellComplete;
    if (!completion || completion.options.length === 0) {
      return null;
    }
    return {
      from: completion.from,
      options: completion.options.map((option) => ({
        label: option.label,
        type: option.type,
        detail: option.detail ?? undefined,
      })),
      // Deliberately no `validFor`: the server already filters by the live
      // prefix, so every keystroke refetches fresh options. Keeping the
      // result client-side "valid" froze the list: typing `r` (3 options)
      // then `u` kept showing all 3 instead of narrowing to `runtime`,
      // and the stale tooltip even broke Tab-accept.
    };
  };
}
